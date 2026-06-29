# 📁 #PROJECT_STRUCTURE
> SmartCut / Daily Barber Hair Studio — Management System
> Last updated: 2026-06-18
> Version: 2.0 — Added Customer History Module, Analytics Dashboard, Notification Center

---

## A) SCREENS

### ⚡ Shared
| Path | Screen Name | Roles | Description |
|------|-------------|-------|-------------|
| `/login` | Login / Auth | All | Role picker (Admin/Barber/Customer), email+password form, demo credential fill |

### 👤 Customer
| Path | Screen Name | Description |
|------|-------------|-------------|
| `/customer/home` | Customer Home | Stats row, service menu hero banner, upcoming appointments, barbers list |
| `/customer/book` | Book Appointment | 4-step flow: service → date/time (calendar + slots) → barber → confirm |
| `/customer/appointments` | My Appointments | Upcoming (with cancel) and past reservations |
| `/customer/history` | Loyalty & History ⭐ NEW | Loyalty tier card, progress bar, preferred barber, top services, timeline |
| `/customer/profile` | Customer Profile | Visit count, total spent, last visit, phone, sign out |

### ✂️ Barber
| Path | Screen Name | Description |
|------|-------------|-------------|
| `/barber/schedule` | Today's Schedule | Timeline of today's appointments with "Done" button per slot |
| `/barber/appointments` | All Appointments | Full reservation list across all dates |
| `/barber/availability` | Availability | Toggle time slots open / blocked |
| `/barber/profile` | Barber Profile | Rating, reviews, total completed, contact info |

### 🛡 Admin
| Path | Screen Name | Description |
|------|-------------|-------------|
| `/admin/overview` | Dashboard Overview | KPI cards, weekly revenue area chart, service pie chart, barber performance grid |
| `/admin/analytics` | Analytics ⭐ NEW | Top barber/service, booking trends (daily/weekly/monthly), peak hours heatmap, repeat customers |
| `/admin/barbers` | Manage Barbers | List with add / remove, status badge, rating display |
| `/admin/services` | Manage Services | Grid with add / remove, price + duration per service |
| `/admin/reservations` | Reservations | Search + status filter, approve / complete / cancel actions |
| `/admin/sales` | Sales Log | Transaction table: ID, customer, service, barber, date, amount, payment method |
| `/admin/reports` | Reports | Summary stats, daily customers bar chart, frequent customers list |

---

## B) REUSABLE COMPONENTS

| Component | File | Description |
|-----------|------|-------------|
| `LoginScreen` | `src/app/components/LoginScreen.tsx` | Auth split-panel with role selector, form, left brand panel |
| `CustomerDashboard` | `src/app/components/CustomerDashboard.tsx` | Customer shell: sidebar nav + 5 animated views (incl. History) |
| `BarberDashboard` | `src/app/components/BarberDashboard.tsx` | Barber shell: sidebar nav + 4 animated views |
| `AdminDashboard` | `src/app/components/AdminDashboard.tsx` | Admin shell: sidebar nav + 7 animated views (incl. Analytics) |
| `CustomerHistoryModule` ⭐ NEW | `src/app/components/CustomerHistoryModule.tsx` | Loyalty tier card, progress bar, preferred barber, service bars, timeline |
| `NotificationCenter` ⭐ NEW | `src/app/components/NotificationCenter.tsx` | Bell icon, slide panel, filter chips, mark-read, dismiss |
| `AnalyticsDashboard` ⭐ NEW | `src/app/components/AnalyticsDashboard.tsx` | KPI cards, trend line/bar chart, barber perf, top services, peak heatmap, repeat rate |
| `Sidebar` | *(inline per dashboard)* | Logo image, nav buttons, user info card, sign out |
| `BookingFlow` | *(inline in CustomerDashboard)* | 4-step stepper with progress bar |
| `ServiceMenuBanner` | *(inline in Customer Home)* | Full-width image card with gradient overlay + CTA |
| `MiniCalendar` | *(inline in BookingFlow)* | Month grid, past-day disabled, selected highlight |
| `TimeSlotGrid` | *(inline in BookingFlow)* | DM Mono font slot buttons, available / blocked states |
| `AppointmentCard` | *(inline, shared)* | Reservation row: icon, service, barber, date/time, status badge, actions |
| `BarberCard` | *(inline, shared)* | Photo, name, speciality, star rating, availability dot |
| `StatCard` | *(inline, shared)* | Label + large value + delta/sub-label |
| `RevenueAreaChart` | *(recharts, AdminDashboard)* | Weekly revenue with gradient fill |
| `ServicePieChart` | *(recharts, AdminDashboard)* | Donut chart — revenue by service category |
| `DailyBarChart` | *(recharts, AdminDashboard + Analytics)* | Customers per day bar chart |
| `BookingTrendLineChart` | *(recharts, AnalyticsDashboard)* | Weekly bookings/completed/cancelled multi-line chart |
| `PeakHoursHeatmap` | *(inline, AnalyticsDashboard)* | HTML table-based heatmap, hours × days, color-coded intensity |
| `AddBarberForm` | *(inline, AdminDashboard)* | Inline collapsible form for adding a barber |
| `AddServiceForm` | *(inline, AdminDashboard)* | Inline collapsible form for adding a service |

---

## C) DESIGN TOKENS

### Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#1b8032` | Daily Barber forest green — all CTAs, active nav, accents |
| `--background` | `#07090a` | Page ground — near-black with green undertone |
| `--card` | `#0e1410` | Card & panel surfaces |
| `--secondary` | `#172018` | Secondary surfaces, input backgrounds |
| `--sidebar` | `#060809` | Sidebar — deepest layer |
| `--foreground` | `#eef4ee` | Primary text — warm green-white |
| `--muted-foreground` | `#75897a` | Labels, captions, subdued text |
| `--destructive` | `#cc3333` | Cancel actions, errors — barber pole red |
| `--border` | `rgba(255,255,255,0.07)` | Hairline card outlines |
| `--ring` | `#1b8032` | Focus rings |
| `Status: Pending` | `#d4a020` | Amber — awaiting action |
| `Status: Confirmed` | `#1b8032` | Green — approved |
| `Status: Completed` | `#3a7dc0` | Blue — done and paid |
| `Status: Cancelled` | `#cc3333` | Red — voided |
| `Loyalty: Bronze` | `#cd7f32` | 0–9 visits |
| `Loyalty: Silver` | `#a8a9ad` | 10–19 visits |
| `Loyalty: Gold` | `#d4a020` | 20–29 visits |
| `Loyalty: Platinum` | `#1b8032` | 30+ visits |
| `Notif: Confirmation` | `#1b8032` | Green — booking confirmed |
| `Notif: Reminder` | `#3a7dc0` | Blue — upcoming appointment |
| `Notif: Promo` | `#d4a020` | Amber — promotional message |
| `Notif: Cancellation` | `#cc3333` | Red — cancellation alert |
| `--chart-1` | `#1b8032` | Primary chart series |
| `--chart-2` | `#56b86e` | Secondary chart series |
| `--chart-3` | `#3a7dc0` | Tertiary chart series |
| `--chart-4` | `#cc3333` | Quaternary chart series |
| `--chart-5` | `#8dcfa1` | Quinary chart series |

### Typography
| Token | Value | Usage |
|-------|-------|-------|
| Primary font | `Inter` | All UI text — weights 400, 500, 600, 700. No italic. |
| Mono font | `DM Mono` | Time slots, transaction IDs, codes — weights 400, 500 |
| `--font-size` (base) | `16px` | Root html font size |
| Display heading | `1.875rem / 700` | Dashboard h1 |
| Section heading | `1.125rem / 600` | Card/section h2 |
| Body | `0.9375rem / 400` | Regular content text |
| Caption / label | `0.8125rem / 500` | Field labels, metadata rows |
| Micro | `0.75rem / 500–600` | Status badges, chart axis labels |
| Mono data | `0.8125rem / 400` | Times, IDs, monospaced fields |

### Spacing & Radius
| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.75rem` | Base border radius — cards, inputs, buttons |
| `--radius-sm` | `0.5rem` | Badges, tight elements |
| `--radius-xl` | `1.25rem` | Large modal / confirmation panels |
| Card padding | `1.25rem` | Standard card internal padding |
| Page padding | `2rem` | Main content area outer padding |
| Sidebar width | `240px` | Fixed — consistent across all three dashboards |
| Grid gap | `1rem` | Standard grid and flex gap |

### Mock Data Summary
| Entity | Count | Notes |
|--------|-------|-------|
| Barbers | 4 | Marco Santos, Dante Reyes, Alex Navarro, Rio Castillo |
| Services | 13 | Based on real Daily Barber Hair Studio menu poster |
| Customers | 10 | Mock Filipino profiles |
| Reservations | 12 | Mixed statuses, dates 2026-06-14 to 2026-06-17 |
| Transactions | 10 | Cash / GCash / Maya payment methods |
| Notifications | 8 | Confirmation, reminder, promo, cancellation, system types |
| Customer Profiles | 3 | Loyalty tier, preferred barber, visit history (customerId 1, 4, 8) |
| Loyalty Tiers | 4 | Bronze (0–9), Silver (10–19), Gold (20–29), Platinum (30+) |
| Peak Hours Data | 8×7 | Hours 09:00–16:00 × Mon–Sun grid |
| Booking Trends | 6 | Weekly bookings/completed/cancelled (May W1 – Jun W2) |
| Barber Performance | 4 | Completions, revenue, rating, repeat customer % |

---

## UPDATE PROTOCOL

Every time a screen or component is added, edited, or removed:
1. Open this file.
2. Update the relevant section (Screens / Components / Tokens).
3. Bump the version number at the top.
4. Update the `Last updated` date.

---

## ENHANCEMENT LOG

| Version | Date | Changes |
|---------|------|---------|
| v1.0 | 2026-06-16 | Initial build — Login, Customer, Barber, Admin dashboards |
| v2.0 | 2026-06-18 | Added Customer History Module, Analytics Dashboard, Notification Center |
