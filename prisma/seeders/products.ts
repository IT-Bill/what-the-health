import type { PrismaClient } from "../../src/generated/prisma/client";

export const PRODUCTS = [
  { name: "Smart Watch", description: "Seamlessly track your vitals and daily movement with understated elegance.", priceCredits: 1200, sortOrder: 0, image: "/api/assets/static/products/smart-watch.jpg" },
  { name: "Oura Ring", description: "Discreet sleep and recovery insights housed in a minimal titanium band.", priceCredits: 850, sortOrder: 1, image: "/api/assets/static/products/oura-ring.jpg" },
  { name: "Organic Granola", description: "Small-batch roasted oats, nuts, and seeds sweetened with raw honey.", priceCredits: 50, sortOrder: 2, image: "/api/assets/static/products/organic-granola.jpg" },
  { name: "Artisan Bread", description: "Freshly baked, stone-ground whole wheat sourdough for a nourishing start.", priceCredits: 30, sortOrder: 3, image: "/api/assets/static/products/artisan-bread.jpg" },
  { name: "Smart Scale", description: "Comprehensive body composition metrics presented through a pristine glass surface.", priceCredits: 450, sortOrder: 4, image: "/api/assets/static/products/smart-scale.jpg" },
  { name: "Stone Diffuser", description: "Scent your sanctuary with this handcrafted matte ceramic ultrasonic diffuser.", priceCredits: 120, sortOrder: 5, image: "/api/assets/static/products/stone-diffuser.jpg" },
];

export async function seedProducts(prisma: PrismaClient) {
  for (const p of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) await prisma.product.update({ where: { id: existing.id }, data: p });
    else await prisma.product.create({ data: p });
  }
}
