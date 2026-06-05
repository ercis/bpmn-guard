"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

/**
 * Injects word-wrap toggle buttons into Streamdown code block headers.
 * Call this hook in a component that wraps the Streamdown output.
 */
export function useCodeBlockWrapButtons(
  containerRef: RefObject<HTMLElement | null>
) {
  const isInjectingRef = useRef(false);
  const processedBlocksRef = useRef(new WeakSet<Element>());

  const injectButtons = useCallback(() => {
    const container = containerRef.current;
    if (!container || isInjectingRef.current) return;

    isInjectingRef.current = true;

    try {
      const codeBlocks = container.querySelectorAll(
        '[data-streamdown="code-block"]'
      );

      codeBlocks.forEach((codeBlock) => {
        // Skip if already processed
        if (processedBlocksRef.current.has(codeBlock)) {
          return;
        }

        const header = codeBlock.querySelector(
          '[data-streamdown="code-block-header"]'
        );
        if (!header) return;

        const actionsContainer = header.querySelector(".flex.items-center.gap-2");
        if (!actionsContainer) return;

        // Mark as processed before modifying DOM
        processedBlocksRef.current.add(codeBlock);

        // Create the button element directly (no React root needed)
        const button = document.createElement("button");
        button.className =
          "cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground";
        button.setAttribute("data-streamdown", "code-block-wrap-button");
        button.setAttribute("title", "Toggle word wrap");
        button.setAttribute("type", "button");
        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="6" y2="6"/><path d="M3 12h15a3 3 0 1 1 0 6h-4"/><polyline points="16 16 14 18 16 20"/><line x1="3" x2="10" y1="18" y2="18"/></svg>`;

        button.addEventListener("click", () => {
          const isWrapped = codeBlock.getAttribute("data-wrap") === "true";
          if (isWrapped) {
            codeBlock.removeAttribute("data-wrap");
            button.classList.remove("text-foreground");
            button.classList.add("text-muted-foreground");
          } else {
            codeBlock.setAttribute("data-wrap", "true");
            button.classList.add("text-foreground");
            button.classList.remove("text-muted-foreground");
          }
        });

        // Insert before the first child (before copy button)
        actionsContainer.insertBefore(button, actionsContainer.firstChild);
      });
    } finally {
      isInjectingRef.current = false;
    }
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initial injection
    injectButtons();

    // Use MutationObserver for streaming content
    const observer = new MutationObserver((mutations) => {
      // Only process if new nodes were added that might be code blocks
      const hasRelevantChanges = mutations.some(
        (mutation) =>
          mutation.type === "childList" &&
          mutation.addedNodes.length > 0 &&
          Array.from(mutation.addedNodes).some(
            (node) =>
              node.nodeType === Node.ELEMENT_NODE &&
              ((node as Element).querySelector?.(
                '[data-streamdown="code-block"]'
              ) ||
                (node as Element).matches?.('[data-streamdown="code-block"]'))
          )
      );

      if (hasRelevantChanges) {
        injectButtons();
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [containerRef, injectButtons]);
}
