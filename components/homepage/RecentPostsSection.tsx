"use client";

import { motion } from "framer-motion";
import { OptimizedImage } from "@/components/ui/optimized-image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Calendar, User, ArrowRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Post {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  published_at: string | null;
  author?: {
    full_name: string | null;
  };
}

interface RecentPostsSectionProps {
  posts: Post[];
}

export function RecentPostsSection({ posts }: RecentPostsSectionProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.8,
        ease: "easeOut" as const,
      },
    },
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Generate placeholder image
  const getImageUrl = (post: Post) => {
    return (
      post.featured_image_url ||
      `https://placehold.co/600x400/171717/ffffff?text=${encodeURIComponent(
        post.title,
      )}`
    );
  };

  if (!posts || posts.length === 0) {
    return null;
  }

  return (
    <section className="relative py-12 sm:py-16 md:py-20 lg:py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />

      {/* Floating Background Elements */}
      <div className="absolute top-20 right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile-First Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="mb-8 sm:mb-12 md:mb-16"
        >
          {/* Unified Header for All Screen Sizes */}
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/20 shadow-premium">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tight">
                Latest <span className="gradient-text-primary">Guides</span>
              </h2>
            </div>
            <p className="max-w-2xl mx-auto text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground leading-relaxed px-4 sm:px-0">
              Insider tips, local secrets, and comprehensive guides to help you
              experience Karachi like a true local.
            </p>
          </div>
        </motion.div>

        {/* Posts Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8"
        >
          {posts.map((post, index) => {
            const imageUrl = getImageUrl(post);
            const isLarge = index === 0; // Make first post larger

            return (
              <motion.div
                key={post.id}
                variants={itemVariants}
                whileHover={{ y: -5 }}
                className={cn("group", isLarge && "md:col-span-2")}
              >
                <Link href={`/guides/${post.slug}`}>
                  <div
                    className={cn(
                      "relative bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl md:rounded-3xl shadow-premium hover:shadow-premium-lg transition-all duration-500 overflow-hidden",
                      isLarge
                        ? "flex flex-col md:flex-row md:items-center"
                        : "flex flex-col",
                    )}
                  >
                    {/* Image Container */}
                    <div
                      className={cn(
                        "relative overflow-hidden rounded-t-2xl md:rounded-t-3xl",
                        isLarge
                          ? "aspect-[16/10] md:w-1/2 md:aspect-[4/3] md:rounded-l-3xl md:rounded-tr-none"
                          : "aspect-[16/10]",
                      )}
                    >
                      <OptimizedImage
                        src={imageUrl}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                        fallbackSrc={`https://placehold.co/600x400/171717/ffffff?text=Article+Image`}
                      />

                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

                      {/* Reading Time Badge */}
                      <div className="absolute top-3 left-3 md:top-4 md:left-4 z-10">
                        <Badge className="bg-background/20 backdrop-blur-sm text-white border border-white/20 text-xs px-2 py-1">
                          <Clock className="h-3 w-3 mr-1" />5 min read
                        </Badge>
                      </div>
                    </div>

                    {/* Content */}
                    <div
                      className={cn(
                        "p-4 md:p-6 space-y-3 md:space-y-4 flex-1",
                        isLarge && "md:w-1/2 md:p-8 md:space-y-6",
                      )}
                    >
                      {/* Meta Information */}
                      <div className="flex items-center space-x-3 md:space-x-4 text-sm text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
                          <span className="text-xs md:text-sm">
                            {post.published_at
                              ? formatDate(post.published_at)
                              : "No date"}
                          </span>
                        </div>
                        {post.author?.full_name && (
                          <div className="flex items-center space-x-1">
                            <User className="h-3.5 w-3.5 md:h-4 md:w-4" />
                            <span className="text-xs md:text-sm truncate">
                              {post.author.full_name}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <h3
                        className={cn(
                          "font-bold text-foreground group-hover:text-primary transition-colors duration-300 leading-tight",
                          isLarge
                            ? "text-lg md:text-xl lg:text-2xl line-clamp-2 md:line-clamp-3"
                            : "text-base md:text-lg line-clamp-2",
                        )}
                      >
                        {post.title}
                      </h3>

                      {/* Excerpt */}
                      {post.excerpt && (
                        <p
                          className={cn(
                            "text-muted-foreground leading-relaxed",
                            isLarge
                              ? "text-sm md:text-base lg:text-lg line-clamp-2 md:line-clamp-3"
                              : "text-sm md:text-base line-clamp-2 md:line-clamp-3",
                          )}
                        >
                          {post.excerpt}
                        </p>
                      )}

                      {/* Read More */}
                      <div className="flex items-center justify-between pt-3 md:pt-4 border-t border-border/50">
                        <span className="text-xs md:text-sm font-semibold text-primary">
                          Read Full Guide
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary group-hover:translate-x-1 transition-transform duration-300" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        {/* View All Posts CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="text-center mt-12 md:mt-16"
        >
          <Link href="/guides">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center space-x-3 px-6 sm:px-8 py-3 sm:py-4 rounded-2xl bg-background/60 backdrop-blur-xl border border-border/50 shadow-premium hover:shadow-premium-lg transition-all duration-300 group"
            >
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" />
              <span className="text-base sm:text-lg font-semibold text-foreground">
                Explore All Guides
              </span>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 text-primary group-hover:translate-x-1 transition-transform duration-300" />
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
