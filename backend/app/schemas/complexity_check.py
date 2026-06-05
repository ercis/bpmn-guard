from pydantic import BaseModel, Field
from typing import Dict, Tuple


class CWBreakdownStrict(BaseModel):
    """Exact breakdown of the Cognitive Weight score components."""

    # Task related
    standard_tasks: int = Field(ge=0, description="Count of standard tasks (W=1).")
    loop_tasks: int = Field(ge=0, description="Count of tasks with loop characteristics (W=6).")
    sub_processes: int = Field(ge=0, description="Count of sub-process containers (W=2).")

    # Gateway related
    xor_binary: int = Field(ge=0, description="XOR splits with 2 branches (W=2).")
    xor_case: int = Field(ge=0, description="XOR splits with >2 branches (W=3).")
    and_splits: int = Field(ge=0, description="Parallel (AND) splits (W=4).")
    or_splits: int = Field(ge=0, description="Inclusive (OR) splits (W=7).")
    event_gateways: int = Field(ge=0, description="Event-based gateways (W=6).")

    # Event related
    events: int = Field(ge=0, description="Start, End, Intermediate, and Boundary events (W=1)")


class ComplexityCheckResult(BaseModel):
    """Response schema for complexity check results."""

    cfc_score: int = Field(
        ge=0, description="Score for control flow complexity. A lower score indicates a less complex process model."
    )
    cfc_breakdown: Dict[str, Tuple[int, int]] = Field(
        description="Breakdown of CFC logic. Keys are descriptive strings, values are tuples of (weight, count) where weight is the complexity weight per instance and count is the number of instances."
    )

    cw_score: int = Field(
        ge=0,
        description="Score for cognitive weight. A lower score indicates a less complex process model. \n Sub-process: weight = 2 per sub-process.\nXOR split with fan-out ≤ 2: weight = 2; XOR split with fan-out > 2: weight = 3.\nAND split: weight = 4.\nOR split: weight = 7.\nEvent-based gateway: weight = 6.\nEvents (start/end/intermediate/boundary): weight = 1 each.",
    )

    cw_breakdown: CWBreakdownStrict = Field(
        description="A strict breakdown of the cognitive-weight score components. Each component has a fixed weight defined in the CWBreakdownStrict schema. The actual quantity of each component type is stored in the corresponding variables. To compute the total score, multiply the quantity of each component by its fixed weight, then sum all resulting values. A lower score indicates a less complex process model."
    )
