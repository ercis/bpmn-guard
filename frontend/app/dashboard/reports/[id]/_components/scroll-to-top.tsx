'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowUp } from "lucide-react";
import { useRightSidebar } from "@/components/ui/right-sidebar";

export function ScrollToTop() {
    const [showButton, setShowButton] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const { state, width } = useRightSidebar();

    const isSidebarOpen = state === 'expanded';

    useEffect(() => {
        const findScrollContainer = (): HTMLElement | null => {
            let element = buttonRef.current?.parentElement;
            while (element) {
                const style = window.getComputedStyle(element);
                if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                    return element;
                }
                element = element.parentElement;
            }
            return null;
        };

        const scrollContainer = findScrollContainer();
        if (!scrollContainer) return;

        const handleScroll = () => {
            setShowButton(scrollContainer.scrollTop > 400);
        };

        scrollContainer.addEventListener('scroll', handleScroll);
        handleScroll();

        return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        let element = buttonRef.current?.parentElement;
        while (element) {
            const style = window.getComputedStyle(element);
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                element.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            element = element.parentElement;
        }
    };

    return (
        <button
            ref={buttonRef}
            onClick={scrollToTop}
            style={{
                right: isSidebarOpen ? `calc(${width} + 1.5rem)` : '1.5rem',
            }}
            className={`
                fixed bottom-6 z-50
                h-11 w-11
                flex items-center justify-center
                rounded-full
                bg-primary text-primary-foreground
                shadow-lg shadow-primary/25
                hover:bg-primary/90 hover:scale-105 hover:cursor-pointer
                active:scale-95
                transition-all duration-200 ease-out
                ${showButton
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4 pointer-events-none'
                }
            `}
            aria-label="Scroll to top"
        >
            <ArrowUp className="h-5 w-5" />
        </button>
    );
}
