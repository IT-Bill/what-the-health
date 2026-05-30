import type { PrismaClient } from "../../src/generated/prisma/client";

export const PRODUCTS = [
  { name: "Smart Watch", description: "Seamlessly track your vitals and daily movement with understated elegance.", priceCredits: 1200, sortOrder: 0, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBdYwvnSRAot7aGsVxuxexq-hFhV9RvfMXy-O6d6ZY9XzFtCQkraCJQCVPWN4l9gfEvzallUbyuw_eIOYQer6e3ybtqznDBA89bR61tJBwfJQx8tTVWQeaM2D6sURd02817gkV5YQY55VyfXxdCUbNwwo9VkgC9gg5FabcP0_cIhztiB5F3aPvIrEiexarwPhhUWzFoOVDHpziwmwHq64jHCzWThOrAA2U_0f5HCI0LAFim36YxwZNN8lSLF6zPbJr2VJ5lKhEBWK0" },
  { name: "Oura Ring", description: "Discreet sleep and recovery insights housed in a minimal titanium band.", priceCredits: 850, sortOrder: 1, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDgToyXPhU2hCsNiMmFVuiDB1qlES2-PoZRMP7XzGC6vnqzIAl6-gVtkCH_4aXhn2PLFBhJ_k84844bhK3qDRZ3vQpPGWYJm5WKDvkXjNOqgYNf9jk8VRrymm5ejIh8IDOlmIVJ7TQpVAbnsnqqCAwEar4l4y9hQtDTGFGE2HA73bnbO503ajj51lCxbNBg140SzXYxxIXM086GVQQn1lUvgb6zkXwRz_YUjRQpf0dd1fsnjbO4ThMbP6vDFZtWai22jOLOreumz2g" },
  { name: "Organic Granola", description: "Small-batch roasted oats, nuts, and seeds sweetened with raw honey.", priceCredits: 50, sortOrder: 2, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCEvkFa4s98NX8lvz-rlJVw2DHal2RtsnQ1WKux5RWikXqfbdKkr8Bhf64PqjD12PX_3oxgN3VOW71ttymrNHTZJxCzDDnq5fFenl8wPmbhYpDRXmpxO3tt0BAZBLnPco5T9mFgzUjvmVlkdm-L3UGBL3LTivOBEaK4feNsuRdoLvH2oTKv7VFeplnK9F5Nqx5HFm-RXxJxtHl1dOa-o5B_Zm_D3kcg3YlZfS8fo53eBDC-5v6ZoOh9lZGpfKFwvsEVVxcQ3rvIWlA" },
  { name: "Artisan Bread", description: "Freshly baked, stone-ground whole wheat sourdough for a nourishing start.", priceCredits: 30, sortOrder: 3, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuALM9Qp-7kffqXeIoIxamqU0r0QJ06p9p_Iz0WJKhM3Bw5adJ6Gpohm5vBDyffClNwpaWevXWWJ_nML_0T4BV6OyHpO_l-BLnugqjoDI46OsLCDYRAF-e8wLB3sLxj95H_s5JPX7pJJy_bhry7GeMp1kdAD_SooAXPojxsP7OUF51qdHOGeRhDNbEtZIWnYAFXaEx0CYLfdadUAlR11P-RpdKvaUTf8HMVbNun61eegu6yMCNPLIolv_BTc9ahDhAH-iEomfVfAjDY" },
  { name: "Smart Scale", description: "Comprehensive body composition metrics presented through a pristine glass surface.", priceCredits: 450, sortOrder: 4, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDkpxmFZ3TQRjeUywB7GNOsXrvyMNspR7-oPUufnUb308pSOOYxRYYIpj-lCQ9GhznyxxqM1SgiOwXIfvPq0VfQcY0V66h1t3KwOhe-ezZiTPvNwGKM2wE_8SXcJ8bwzup_LS4U02604wucaWdg6vZFN9yo_5OsuM5itY5pRFetv2LGMZJM_TphKODBve-cfFZJEr8uayrFBUI2M-FGbhDYDf1Gp3yVHilB874pLbh0HxCyiFSmOFKNWsJHvNSYb8e8jAZTGGDq3Ww" },
  { name: "Stone Diffuser", description: "Scent your sanctuary with this handcrafted matte ceramic ultrasonic diffuser.", priceCredits: 120, sortOrder: 5, image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDXpEYMtYdtoHmouHGZKkNlsHjO8tdaysA5pSr8hQMjhVxfvlxhhLKoVcYoonB6TdaovJlYVpKu0mapHpzvdxPxdmR57aipfzugWTIXsU_axMGUQOhRxx0t3DChhZQEU2RU_DhW2wqRJQmsKmrhv9cugDxHlWCi2MA6WAsInmeOMgcWWmRA841rt947E21hLUckqK2GUWOqXJSnHVs5bohz6QIRkWDZu1KurGwzN9lLp2MHWRozg3Jh3FqNiu2ebYNIVb7VArkO9sQ" },
];

export async function seedProducts(prisma: PrismaClient) {
  for (const p of PRODUCTS) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) await prisma.product.update({ where: { id: existing.id }, data: p });
    else await prisma.product.create({ data: p });
  }
}
