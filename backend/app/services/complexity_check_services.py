import logging
import xml.etree.ElementTree as ET
import re
from collections import defaultdict

from langsmith import traceable

from app.schemas.complexity_check import ComplexityCheckResult, CWBreakdownStrict
from app.db.models.bpmn_model import BPMNModel

logger = logging.getLogger(__name__)


def get_namespace(root):
    """Extracts the BPMN namespace uri."""
    match = re.match(r"\{(.*)\}", root.tag)
    return {"bpmn": match.group(1)} if match else {"bpmn": "http://www.omg.org/spec/BPMN/20100524/MODEL"}


def _build_gateway_fanout_map(root, namespace):
    """
    Build a map of gateway IDs to their outgoing sequence flows (fan-out count).
    """
    all_sequence_flows = root.findall(".//bpmn:sequenceFlow", namespace)
    gateway_fanout_map = defaultdict(list)

    for sequence_flow in all_sequence_flows:
        source_gateway_id = sequence_flow.get("sourceRef")
        if source_gateway_id:
            gateway_fanout_map[source_gateway_id].append(sequence_flow)

    return gateway_fanout_map


def _calculate_task_complexity(root, namespace, cw_breakdown):
    """
    Calculate cognitive weight for all task types.
    Updates keys: 'standard_tasks', 'loop_tasks'
    """
    task_types = [
        "task",
        "userTask",
        "serviceTask",
        "scriptTask",
        "manualTask",
        "sendTask",
        "receiveTask",
        "businessRuleTask",
    ]

    total_weight = 0

    for task_type in task_types:
        tasks = root.findall(f".//bpmn:{task_type}", namespace)
        for task in tasks:
            multi_instance_loop = task.find(".//bpmn:multiInstanceLoopCharacteristics", namespace)
            standard_loop = task.find(".//bpmn:standardLoopCharacteristics", namespace)

            if multi_instance_loop is not None or standard_loop is not None:
                weight = 6
                cw_breakdown["loop_tasks"] += 1
            else:
                weight = 1
                cw_breakdown["standard_tasks"] += 1

            total_weight += weight

    return total_weight


def _calculate_subprocess_complexity(root, namespace, cw_breakdown):
    """
    Calculate cognitive weight for sub-processes.
    Updates key: 'sub_processes'
    """
    sub_processes = root.findall(".//bpmn:subProcess", namespace)
    total_weight = len(sub_processes) * 2
    cw_breakdown["sub_processes"] += len(sub_processes)
    return total_weight


def _calculate_gateway_complexity(root, namespace, gateway_fanout_map, cw_breakdown):
    """
    Calculate cognitive weight (CW) for gateways and gather fan-out data for CFC.
    Updates keys: 'xor_binary', 'xor_case', 'and_splits', 'or_splits', 'event_gateways'
    """
    total_weight = 0

    # Dictionaries to store fan-out for CFC calculation later
    xor_fanout = {}
    and_fanout = {}
    or_fanout = {}
    event_based_fanout = {}

    # 1. XOR (Exclusive) Gateways
    xor_gateways = root.findall(".//bpmn:exclusiveGateway", namespace)
    for gateway in xor_gateways:
        gateway_id = gateway.get("id")
        fan_out = len(gateway_fanout_map[gateway_id])
        xor_fanout[gateway_id] = fan_out

        # CW Logic
        if fan_out <= 2:
            weight = 2
            cw_breakdown["xor_binary"] += 1
        else:
            weight = 3
            cw_breakdown["xor_case"] += 1
        total_weight += weight

    # 2. AND (Parallel) Gateways
    and_gateways = root.findall(".//bpmn:parallelGateway", namespace)
    for gateway in and_gateways:
        gateway_id = gateway.get("id")
        and_fanout[gateway_id] = len(gateway_fanout_map[gateway_id])

        # CW Logic
        total_weight += 4
        cw_breakdown["and_splits"] += 1

    # 3. OR (Inclusive) Gateways
    or_gateways = root.findall(".//bpmn:inclusiveGateway", namespace)
    for gateway in or_gateways:
        gateway_id = gateway.get("id")
        or_fanout[gateway_id] = len(gateway_fanout_map[gateway_id])

        # CW Logic
        total_weight += 7
        cw_breakdown["or_splits"] += 1

    # 4. Event-Based Gateways
    event_based_gateways = root.findall(".//bpmn:eventBasedGateway", namespace)
    for gateway in event_based_gateways:
        gateway_id = gateway.get("id")
        event_based_fanout[gateway_id] = len(gateway_fanout_map[gateway_id])

        # CW Logic
        total_weight += 6
        cw_breakdown["event_gateways"] += 1

    return total_weight, xor_fanout, and_fanout, or_fanout, event_based_fanout


def _calculate_event_complexity(root, namespace, cw_breakdown):
    """
    Calculate cognitive weight for all event types.
    Updates key: 'events'
    """
    event_types = ["startEvent", "endEvent", "intermediateThrowEvent", "intermediateCatchEvent", "boundaryEvent"]

    total_events = 0
    total_weight = 0

    for event_type in event_types:
        events = root.findall(f".//bpmn:{event_type}", namespace)
        count = len(events)
        total_events += count
        total_weight += count  # Events have weight 1

    cw_breakdown["events"] += total_events
    return total_weight


def _update_cfc_breakdown_entry(cfc_breakdown, key, weight, increment=1):
    """Track CFC weight and occurrence count for each key."""
    if key in cfc_breakdown:
        existing_weight, existing_count = cfc_breakdown[key]
        cfc_breakdown[key] = (existing_weight, existing_count + increment)
    else:
        cfc_breakdown[key] = (weight, increment)


def _calculate_control_flow_complexity(xor_fanout, and_fanout, or_fanout, event_based_fanout, cfc_breakdown):
    """
    Calculate Control Flow Complexity (CFC) based on Cardoso's metric.
    Groups results by fan-out to provide detailed breakdown.
    """
    total_cfc = 0

    # 1. XOR Splits (Choice = number of paths)
    """Formula: CFC = fan-out """
    for gid, fanout in xor_fanout.items():
        weight = fanout
        total_cfc += weight
        # Groups gateways by fan-out, e.g., "XOR Split (W=Fan-out, Fan-out=3)"
        key = f"XOR Split (W=Fan-out, Fan-out={fanout})"
        _update_cfc_breakdown_entry(cfc_breakdown, key, weight)

    # 2. Event-Based Gateways (treated as XOR choice)
    """Formula: CFC = fan-out"""
    for gid, fanout in event_based_fanout.items():
        weight = fanout
        total_cfc += weight
        key = f"Event-Based Split (W=Fan-out, Fan-out={fanout})"
        _update_cfc_breakdown_entry(cfc_breakdown, key, weight)

    # 3. OR Splits (Choice = 2^n - 1 combinations)
    """ Formula: CFC = 2^fanout - 1 """
    for gid, fanout in or_fanout.items():
        weight = (2**fanout) - 1 if fanout > 0 else 0
        total_cfc += weight
        key = f"OR Split (W=2^Fan-out - 1, Fan-out={fanout})"
        _update_cfc_breakdown_entry(cfc_breakdown, key, weight)

    # 4. AND Splits (No choice, cost = 1)
    """Formula: CFC = 1 (Fan-out not relevant for weight)"""
    and_len = len(and_fanout)

    weight = 1 * and_len
    total_cfc += weight
    key = "AND Split (W=1)"
    if and_len:
        _update_cfc_breakdown_entry(cfc_breakdown, key, 1, and_len)

    return total_cfc


@traceable(run_type="tool", name="Complexity Check - Scientific")
def evaluate_scientific_complexity(bpmn_model: BPMNModel) -> ComplexityCheckResult | None:
    """
    Final evaluation function to compute both Cognitive Weight (CW) and Control Flow Complexity (CFC).
    Returns a ResultComplexityCheck object containing both scores and their breakdowns.
    """
    logger.info(f"Starting complexity check for model {bpmn_model.id}")

    bpmn_xml_str = bpmn_model.bpmn_xml
    if not bpmn_xml_str:
        raise ValueError("BPMN model does not have XML content available")
    tree = ET.ElementTree(ET.fromstring(bpmn_xml_str))
    root = tree.getroot()
    namespace = get_namespace(root)

    gateway_fanout_map = _build_gateway_fanout_map(root, namespace)

    # Initialize Dictionary with strict keys required by CWBreakdownStrict
    cw_breakdown_dict = {
        "standard_tasks": 0,
        "loop_tasks": 0,
        "sub_processes": 0,
        "xor_binary": 0,
        "xor_case": 0,
        "and_splits": 0,
        "or_splits": 0,
        "event_gateways": 0,
        "events": 0,
    }

    task_weight = _calculate_task_complexity(root, namespace, cw_breakdown_dict)
    subprocess_weight = _calculate_subprocess_complexity(root, namespace, cw_breakdown_dict)
    gateway_cw, xor_fanout, and_fanout, or_fanout, event_based_fanout = _calculate_gateway_complexity(
        root, namespace, gateway_fanout_map, cw_breakdown_dict
    )
    event_weight = _calculate_event_complexity(root, namespace, cw_breakdown_dict)

    total_cw_score = task_weight + subprocess_weight + gateway_cw + event_weight

    # CFC Calculation
    cfc_breakdown_dict: dict[str, tuple[int, int]] = {}
    total_cfc_score = _calculate_control_flow_complexity(
        xor_fanout, and_fanout, or_fanout, event_based_fanout, cfc_breakdown_dict
    )

    logger.info(f"Complexity check completed for model {bpmn_model.id}: CW={total_cw_score}, CFC={total_cfc_score}")
    return ComplexityCheckResult(
        cfc_score=total_cfc_score,
        cfc_breakdown=dict(cfc_breakdown_dict),
        cw_score=total_cw_score,
        cw_breakdown=CWBreakdownStrict(**cw_breakdown_dict),
    )
