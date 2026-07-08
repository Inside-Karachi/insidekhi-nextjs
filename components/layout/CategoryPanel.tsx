"use client";

import Link from "next/link";
import * as React from "react";
import { motion } from "framer-motion";
import { ChevronLeft, Compass } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { iconMap } from "@/config/nav";

type SubCategory = { id: number; name: string; slug: string };
type ParentCategory = {
  id: number;
  name: string;
  slug: string;
  categories?: SubCategory[];
};

interface CategoryPanelProps {
  categories: ParentCategory[];
  onBack: () => void;
  onLinkClick: () => void;
}

// Animation variants for the list and items
const listVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05, // Each child will animate 0.05s after the previous one
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export function CategoryPanel({
  categories,
  onBack,
  onLinkClick,
}: CategoryPanelProps) {
  return (
    <motion.div
      key="categories"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="absolute inset-0 flex flex-col bg-background p-4"
    >
      {/* Panel Header */}
      <div className="flex items-center pb-4 border-b">
        <Button variant="ghost" size="icon" className="-ml-2" onClick={onBack}>
          <ChevronLeft className="h-6 w-6" />
        </Button>
        <h2 className="text-lg sm:text-xl font-bold mx-auto">Categories</h2>
        <div className="w-8"></div> {/* Spacer */}
      </div>

      {/* Accordion List */}
      <div className="flex-grow overflow-y-auto pt-6 custom-scrollbar">
        <Accordion type="single" collapsible className="w-full">
          {categories.map((parent) => (
            <AccordionItem value={`item-${parent.id}`} key={parent.id}>
              <AccordionTrigger className="px-4 font-semibold text-base hover:no-underline">
                <span className="flex items-center gap-3">
                  {React.createElement(iconMap[parent.slug] || Compass, {
                    className: "h-5 w-5 text-muted-foreground",
                  })}
                  {parent.name}
                </span>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                {/* Motion list container */}
                <motion.div
                  className="flex flex-col space-y-1"
                  variants={listVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {parent.categories?.map((child) => (
                    // Each link is now a motion component
                    <motion.div key={child.id} variants={itemVariants}>
                      <Link
                        href={`/listings/${child.slug}`}
                        onClick={onLinkClick}
                        className="block p-3 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      >
                        {child.name}
                      </Link>
                    </motion.div>
                  ))}
                  <motion.div variants={itemVariants}>
                    <Link
                      href={`/listings/${parent.slug}`}
                      onClick={onLinkClick}
                      className="block p-3 rounded-md font-semibold text-primary hover:bg-secondary transition-colors"
                    >
                      View All in {parent.name}
                    </Link>
                  </motion.div>
                </motion.div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </motion.div>
  );
}
