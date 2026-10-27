import {
  Baby, Bird, BookOpen, Briefcase, Bus, Car, Check, Circle, Clapperboard, Coffee, Coins, CreditCard,
  Dumbbell, Flower2, Gem, Gift, GraduationCap, HandCoins, Heart, HeartPulse, House, KeyRound, Landmark,
  Laptop, Leaf, Lightbulb, Music, PawPrint, PenLine, PiggyBank, Plane, Receipt, Repeat, Scissors, Search,
  ShieldCheck, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Sprout, Star, SlidersHorizontal,
  Target, TreePalm, TrendingUp, Umbrella, Utensils, Wallet, Wifi, Wine, type LucideIcon,
} from 'lucide-react'
import { solid } from '../lib/colors'
import type { ColorKey } from '../lib/types'

/** Icones de linha que podem ser escolhidos para categorias, origens, metas e dividas. */
export const PICKABLE: Record<string, LucideIcon> = {
  home: House, cart: ShoppingCart, car: Car, utensils: Utensils, bulb: Lightbulb, health: HeartPulse,
  education: GraduationCap, film: Clapperboard, phone: Smartphone, bag: ShoppingBag, sparkles: Sparkles,
  plane: Plane, card: CreditCard, bank: Landmark, trend: TrendingUp, coins: Coins, shield: ShieldCheck,
  gift: Gift, briefcase: Briefcase, wallet: Wallet, piggy: PiggyBank, flower: Flower2, baby: Baby,
  paw: PawPrint, coffee: Coffee, dumbbell: Dumbbell, scissors: Scissors, gem: Gem, bus: Bus, wifi: Wifi,
  music: Music, book: BookOpen, umbrella: Umbrella, target: Target, palm: TreePalm, key: KeyRound,
  laptop: Laptop, receipt: Receipt, 'hand-coins': HandCoins, shirt: Shirt, wine: Wine, leaf: Leaf,
  sprout: Sprout, heart: Heart, star: Star,
}
const INTERNAL: Record<string, LucideIcon> = { circle: Circle, search: Search, check: Check, sliders: SlidersHorizontal, repeat: Repeat, pen: PenLine, bird: Bird }
const ALL = { ...PICKABLE, ...INTERNAL }
export const ICON_KEYS = Object.keys(PICKABLE)

/** Nome desconhecido (ex.: dados antigos com emoji) vira um circulo discreto. */
export function Icon({ name, size = 18, className, strokeWidth = 1.7 }: { name: string; size?: number; className?: string; strokeWidth?: number }) {
  const C = ALL[name] ?? Circle
  return <C size={size} strokeWidth={strokeWidth} className={className} aria-hidden />
}

/** Icone dentro de um quadrado arredondado em tom pastel. */
export function IconBadge({ name, color, size = 38 }: { name: string; color: ColorKey; size?: number }) {
  return (
    <span className="grid place-items-center shrink-0 rounded-[13px]"
      style={{
        width: size, height: size,
        background: `color-mix(in srgb, ${solid(color)} 22%, transparent)`,
        color: `color-mix(in srgb, ${solid(color)} 70%, var(--ink))`,
      }}>
      <Icon name={name} size={Math.round(size * 0.47)} />
    </span>
  )
}
