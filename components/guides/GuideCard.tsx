"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { OptimizedImage } from "@/components/ui/optimized-image";
import { Calendar, User, ArrowRight } from "lucide-react";

interface GuideCardPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  published_at: string | null;
  author?: { full_name: string | null };
}

export function GuideCard({ post }: { post: GuideCardPost }) {
  const imageUrl =
    post.featured_image_url ||
    `https://placehold.co/600x400/171717/ffffff?text=${encodeURIComponent(post.title)}`;

  const formattedDate = post.published_at
    ? new Date(post.published_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <motion.div whileHover={{ y: -5 }} className="group">
      <Link href={`/guides/${post.slug}`}>
        <div className="relative bg-background/60 backdrop-blur-xl border border-border/50 rounded-2xl shadow-premium hover:shadow-premium-lg transition-all duration-500 overflow-hidden flex flex-col h-full">
          <div className="relative aspect-[16/10] overflow-hidden rounded-t-2xl">
            <OptimizedImage
              src={imageUrl}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-110"
              fallbackSrc="https://placehold.co/600x400/171717/ffffff?text=Guide"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>

          <div className="p-4 md:p-6 space-y-3 flex-1 flex flex-col">
            <div className="flex items-center space-x-3 text-sm text-muted-foreground">
              {formattedDate && (
                <div className="flex items-center space-x-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-xs">{formattedDate}</span>
                </div>
              )}
              {post.author?.full_name && (
                <div className="flex items-center space-x-1">
                  <User className="h-3.5 w-3.5" />
                  <span className="text-xs truncate">{post.author.full_name}</span>
                </div>
              )}
            </div>

            <h3 className="font-bold text-base md:text-lg text-foreground group-hover:text-primary transition-colors line-clamp-2">
              {post.title}
            </h3>

            {post.excerpt && (
              <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
                {post.excerpt}
              </p>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-auto">
              <span className="text-xs font-semibold text-primary">Read Guide</span>
              <ArrowRight className="h-3.5 w-3.5 text-primary group-hover:translate-x-1 transition-transform duration-300" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
