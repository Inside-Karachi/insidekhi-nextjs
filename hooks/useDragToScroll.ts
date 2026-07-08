"use client";

import { useEffect, useRef, RefObject, useState } from 'react';

/**
 * A custom hook to enable horizontal drag-to-scroll behavior on a DOM element.
 * @param ref A React ref object pointing to the scrollable DOM element.
 * @returns An object containing the current dragging state.
 */
export function useDragToScroll(ref: RefObject<HTMLElement | null>) {
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const startPos = useRef(0);
  const scrollLeft = useRef(0);
  const isDown = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // If the device has a fine pointer (mouse/trackpad), disable the custom
    // mouse-based drag-to-scroll behavior so clicks inside cards work and
    // users can rely on arrow buttons or native scrolling. Mobile/touch
    // devices still use native touch scrolling.
    try {
      if (typeof window !== 'undefined' && window.matchMedia) {
        // `(pointer: fine)` is true for mouse/trackpad devices
        const mq = window.matchMedia('(pointer: fine)');
        if (mq.matches) {
          return;
        }
      }
  } catch {
      // If matchMedia throws (very unlikely), fall back to attaching listeners.
    }

    // Movement threshold (px) before we consider the action a drag
    const DRAG_THRESHOLD = 6;

    const onMouseDown = (e: MouseEvent) => {
      isDown.current = true;
      element.style.cursor = 'grabbing';
      startPos.current = e.pageX - element.offsetLeft;
      scrollLeft.current = element.scrollLeft;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown.current) return;
      const x = e.pageX - element.offsetLeft;
      const delta = x - startPos.current;

      // If movement surpasses threshold, mark as dragging and perform scroll
      if (!isDraggingRef.current && Math.abs(delta) > DRAG_THRESHOLD) {
        isDraggingRef.current = true;
        setIsDragging(true);
      }

      if (isDraggingRef.current) {
        e.preventDefault();
        const walk = delta * 1.5;
        element.scrollLeft = scrollLeft.current - walk;
      }
    };

    const onMouseUp = () => {
      isDown.current = false;
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
      element.style.cursor = 'grab';
    };

    // Attach move/up to window so we catch events even when the pointer leaves the element
    element.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Also treat leaving the element as a potential end of interaction
    element.addEventListener('mouseleave', onMouseUp);

    return () => {
      element.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      element.removeEventListener('mouseleave', onMouseUp);
    };
    // Intentionally run once for the lifetime of the element reference
  }, [ref]);

  return { isDragging };
}