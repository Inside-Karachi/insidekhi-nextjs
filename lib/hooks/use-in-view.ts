"use client";

import { useEffect, useState, RefObject } from 'react';

// FIX: The ref can be null initially, so we accept RefObject<Element | null>
export function useInView(ref: RefObject<Element | null>, options?: IntersectionObserverInit) {
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {

    const element = ref.current; 
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInView(entry.isIntersecting);
      },
      {
        rootMargin: '0px',
        threshold: 0.1, 
        ...options,
      }
    );

    observer.observe(element);

    return () => {
      // Use the variable in the cleanup function
      observer.unobserve(element);
    };
  }, [ref, options]);

  return isInView;
}