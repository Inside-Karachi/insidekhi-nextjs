"use client"

import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Search, Utensils, Dessert, Coffee, ChefHat, Compass } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Database } from '@/types/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type MenuSection = Database["public"]["Tables"]["menu_sections"]["Row"] & {
  menu_items: Database["public"]["Tables"]["menu_items"]["Row"][] | null;
};

interface PremiumMenuPanelProps {
  isOpen: boolean
  onClose: () => void
  className?: string
  mobileMode?: boolean
  menuSections: MenuSection[]
  restaurantName: string
}

const sectionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  appetizers: Utensils,
  starters: Utensils,
  "main courses": ChefHat,
  mains: ChefHat,
  main: ChefHat,
  desserts: Dessert,
  drinks: Coffee,
  beverages: Coffee,
};

const formatPrice = (price: number): string => {
  return `Rs ${price.toLocaleString()}`;
};

export function PremiumMenuPanel({
  isOpen,
  onClose,
  className,
  mobileMode = false,
  menuSections,
  restaurantName,
}: PremiumMenuPanelProps) {
  const [activeTab, setActiveTab] = React.useState(0);
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setActiveTab(0);
        setSearchQuery("");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const filteredSections = menuSections.map(section => ({
    ...section,
    menu_items: section.menu_items?.filter(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    ) || []
  })).filter(section => section.menu_items.length > 0);

  const getSectionIcon = (sectionName: string) => {
    const key = Object.keys(sectionIcons).find(k => sectionName.toLowerCase().includes(k));
    return key ? sectionIcons[key] : Utensils;
  };

  const sectionsToShow = searchQuery ? filteredSections : menuSections;
  const activeSection = sectionsToShow[activeTab];

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex justify-center",
        mobileMode ? "h-full w-full" : "absolute top-full left-0 right-0 mt-2 z-50",
        className
      )}
    >
      <div className={cn(
        "bg-background/95 backdrop-blur-xl",
        mobileMode
          ? "w-full h-full"
          : "w-[90vw] max-w-5xl border border-border/50 rounded-2xl shadow-2xl shadow-black/10 dark:shadow-black/30 p-6 max-h-[80vh] overflow-y-auto"
      )}>
        {!mobileMode && (
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground">Menu for {restaurantName}</h3>
              <p className="text-sm text-muted-foreground mt-1">Explore the delicious offerings</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-accent rounded-lg transition-colors text-xl font-light"
            >
              ×
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
          {/* Left Column - Categories */}
          <div className="space-y-6 lg:col-span-1 h-full flex flex-col">
             <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground flex items-center text-base">
                <Compass className="h-5 w-5 mr-3 text-primary" />
                Menu Sections
                </h4>
                {mobileMode && (
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                )}
            </div>
            <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Search menu..."
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setActiveTab(0);
                    }}
                    className="w-full rounded-xl bg-muted/50 border-border/50 pl-9"
                />
            </div>
            <div className="flex-grow overflow-y-auto space-y-2 pr-2">
              {sectionsToShow.map((section, index) => {
                const IconComponent = getSectionIcon(section.name || "");
                const isActive = activeTab === index;
                return (
                  <motion.button
                    key={section.id}
                    onClick={() => setActiveTab(index)}
                    className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-all duration-300",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:scale-[1.01]"
                    )}
                    whileHover={{ scale: isActive ? 1.02 : 1.01 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className={cn("p-1 rounded-lg transition-all duration-300", isActive ? "bg-white/20" : "bg-muted/50")}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <span className="truncate">{section.name}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Right Column - Menu Items */}
          <div className="lg:col-span-2 overflow-y-auto h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeTab}-${activeSection?.id || ''}`}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="p-1"
              >
                {activeSection ? (
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black tracking-tight">
                      <span className="gradient-text-primary">{activeSection.name}</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {(activeSection.menu_items || []).map((item, itemIndex) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: itemIndex * 0.05 }}
                          className="group relative bg-card/40 border border-border/50 rounded-2xl p-4 hover:bg-card/60 transition-all duration-300"
                        >
                          <div className="flex gap-4">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-start justify-between gap-3">
                                <h4 className="font-semibold text-foreground truncate pr-12">{item.name}</h4>
                                <p className="text-sm font-bold text-primary whitespace-nowrap">{formatPrice(item.price || 0)}</p>
                              </div>
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                    <div className="mb-4 rounded-2xl bg-muted/50 p-4 border border-border/30">
                       <Search className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold mb-2">No Results Found</h3>
                    <p className="text-sm text-muted-foreground">Try searching for something else.</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
