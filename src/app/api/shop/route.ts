import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/shop — returns balance, rules, products, recent transactions
export async function GET() {
  // Demo: use first user. Replace with auth in production.
  const user = await prisma.user.findFirst();
  if (!user) {
    return Response.json({ error: "No user found" }, { status: 404 });
  }

  const [rules, products, recentTransactions] = await Promise.all([
    prisma.creditRule.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        action: true,
        name: true,
        description: true,
        amount: true,
        dailyCap: true,
        icon: true,
      },
    }),
    prisma.product.findMany({
      where: { available: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        image: true,
        priceCredits: true,
        available: true,
      },
    }),
    prisma.creditTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        direction: true,
        amount: true,
        balance: true,
        note: true,
        createdAt: true,
      },
    }),
  ]);

  return Response.json({
    balance: user.credits,
    rules,
    products,
    recentTransactions,
  });
}
