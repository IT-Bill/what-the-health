"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  BellOff,
  Bookmark,
  BrainCircuit,
  Calendar,
  CalendarDays,
  Clock,
  AlarmClock,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clipboard,
  Cloud,
  Compass,
  Copy,
  Dumbbell,
  ExternalLink,
  Eye,
  FileText,
  Flag,
  Flame,
  Footprints,
  Globe,
  Hand,
  Heart,
  HeartPulse,
  HelpCircle,
  Hourglass,
  ImagePlus,
  Key,
  Leaf,
  Lock,
  LockOpen,
  Menu,
  MessageCircle,
  Mic,
  Moon,
  MoreVertical,
  NotebookPen,
  Pencil,
  Pin,
  PinOff,
  PersonStanding,
  Plus,
  RefreshCw,
  Ruler,
  Scale,
  Search,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  Square,
  Star,
  Stethoscope,
  Sunrise,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Upload,
  User,
  Users,
  Utensils,
  Watch,
  Waves,
  Wind,
  Volume2,
  VolumeX,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Map from Material Symbols icon names to Lucide components.
 * This is the only place that needs updating when adding new icons.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  // Navigation
  arrow_back: ArrowLeft,
  arrow_left: ArrowLeft,
  arrow_forward: ArrowRight,
  arrow_upward: ArrowUp,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  expand_more: ChevronDown,
  close: X,
  search: Search,
  explore: Compass,
  menu: Menu,

  // Actions
  add: Plus,
  plus: Plus,
  delete: Trash2,
  edit: Pencil,
  edit_note: NotebookPen,
  content_copy: Copy,
  open_in_new: ExternalLink,
  more_vert: MoreVertical,
  push_pin: Pin,
  keep: Pin,
  keep_off: PinOff,
  upload_file: Upload,
  autorenew: RefreshCw,
  magic_button: Sparkles,
  visibility: Eye,
  bookmark: Bookmark,
  check: Check,

  // Communication
  chat_bubble: MessageCircle,
  notifications: Bell,
  notifications_off: BellOff,
  mark_email_read: CheckCircle,
  mic: Mic,
  mic_none: Mic,
  stop: Square,

  // People
  person: User,
  account_circle: User,
  group: Users,
  waving_hand: Hand,

  // Health & Wellness
  favorite: Heart,
  heart: Heart,
  monitor_heart: HeartPulse,
  health_metrics: HeartPulse,
  self_improvement: Sunrise,
  self_care: Leaf,
  psychology: BrainCircuit,
  spa: Leaf,
  fitness_center: Dumbbell,
  directions_walk: Footprints,
  bedtime: Moon,
  nightlight: Moon,
  water_drop: Waves,
  air: Wind,
  local_fire_department: Flame,
  spo2: Stethoscope,
  bloodtype: Stethoscope,
  monitor_weight: Scale,
  scale: Scale,
  straighten: Ruler,
  stairs: TrendingUp,
  waves: Waves,
  mood: PersonStanding,
  battery_0_bar: Zap,

  // Food
  restaurant: Utensils,
  restaurant_menu: Utensils,

  // Content & Media
  add_photo_alternate: ImagePlus,
  auto_stories: Bookmark,
  article: FileText,
  auto_awesome: Sparkles,

  // Device & Settings
  watch: Watch,
  phone_android: Smartphone,
  cloud: Cloud,
  settings: Settings,
  lock: Lock,
  lock_reset: LockOpen,
  shield: Shield,
  language: Globe,
  key: Key,

  // Status & Info
  check_circle: CheckCircle,
  error: CircleAlert,
  warning: TriangleAlert,
  help_outline: HelpCircle,
  flag: Flag,
  hourglass_top: Hourglass,

  // Calendar & Time
  calendar: Calendar,
  calendar_month: Calendar,
  calendar_view_week: CalendarDays,
  timeline: Timer,
  clock: Clock,
  alarm_clock: AlarmClock,

  // Data & Charts
  data_usage: Clipboard,
  trending_up: TrendingUp,
  trending_down: TrendingDown,

  // Misc
  star: Star,
  stars: Sparkles,
};

interface IconProps {
  name: string;
  className?: string;
  size?: number;
  filled?: boolean;
}

/**
 * Renders a Lucide icon by its Material Symbols name.
 * Drop-in replacement for <span className="material-symbols-outlined">{name}</span>
 */
export function Icon({ name, className = "", size = 20, filled = false }: IconProps) {
  const Component = ICON_MAP[name];

  if (!Component) {
    // Fallback: render nothing (or a placeholder in dev)
    if (process.env.NODE_ENV === "development") {
      console.warn(`[Icon] No mapping for "${name}"`);
    }
    return <span className={className}>●</span>;
  }

  return (
    <Component
      size={size}
      className={className}
      fill={filled ? "currentColor" : "none"}
      strokeWidth={1.75}
    />
  );
}

export { ICON_MAP };
