import { motion } from "framer-motion";
import {
  QrCode,
  UtensilsCrossed,
  BarChart3,
  Zap,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

const features = [
  {
    icon: QrCode,
    title: "Scan and Order",
    description:
      "Customers scan a QR code at their table and browse the full menu instantly—no app download required.",
  },
  {
    icon: UtensilsCrossed,
    title: "Digital Menu Management",
    description:
      "Add categories, upload photos, update prices, and mark items available or unavailable in real time.",
  },
  {
    icon: BarChart3,
    title: "Live Order Dashboard",
    description:
      "Receive orders the moment they are placed. Track every table, every item, and every status change.",
  },
  {
    icon: Zap,
    title: "Table-Specific QR Codes",
    description:
      "Every table gets a unique code. The system knows exactly which table placed the order—no guessing.",
  },
];

const steps = [
  "Customer scans the QR code on the table",
  "The full menu loads on their phone",
  "They select items and place the order",
  "The kitchen receives it instantly",
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
              <QrCode className="h-4 w-4 text-background" />
            </div>
            <span className="text-sm font-semibold tracking-tight">
              QR Table Order
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => navigate("/auth")}
          >
            Sign In
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Replacing paper menus, one table at a time
            </div>
            <h1 className="text-5xl font-bold tracking-tight leading-[1.1] sm:text-6xl lg:text-7xl">
              QR-powered ordering
              <br />
              <span className="text-muted-foreground">
                for every table
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed">
              Customers scan a code, browse your menu, and place their order
              straight from their phone. No app. No friction. Just a better
              dining experience.
            </p>
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="cursor-pointer px-8"
                onClick={() => navigate("/auth")}
              >
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="cursor-pointer px-8"
                onClick={() => {
                  document
                    .getElementById("how-it-works")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                See How It Works
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 border-t border-border/50">
        <div className="mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-16 text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything you need, nothing you don&apos;t
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              A focused tool built for restaurants that want to move fast.
            </p>
          </motion.div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="group rounded-xl border border-border/50 bg-card p-6 hover:border-border hover:shadow-sm transition-all"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <feature.icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="py-24 px-6 bg-muted/30 border-t border-border/50"
      >
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-16 text-center"
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              From scan to served in four steps.
            </p>
          </motion.div>
          <div className="space-y-4">
            {steps.map((step, i) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="flex items-center gap-4 rounded-xl border border-border/50 bg-card p-5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-sm font-semibold">
                  {i + 1}
                </div>
                <p className="text-sm font-medium">{step}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-border/50">
        <div className="mx-auto max-w-2xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to modernize your restaurant?
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              Set up your menu, generate QR codes for each table, and start
              taking orders in minutes.
            </p>
            <Button
              size="lg"
              className="mt-8 cursor-pointer px-8"
              onClick={() => navigate("/auth")}
            >
              Start Your Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-foreground">
              <QrCode className="h-3 w-3 text-background" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              QR Table Order
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} QR Table Order. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
