import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, QrCode } from "lucide-react";

export function SetupRestaurant() {
  const { user } = useAuth();
  const createRestaurant = useMutation(api.restaurants.create);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?._id || !name.trim()) return;
    setIsCreating(true);
    try {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      await createRestaurant({
        name: name.trim(),
        slug,
        description: description.trim() || undefined,
        ownerId: user._id,
      });
    } catch (err) {
      console.error("Failed to create restaurant:", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-foreground">
            <QrCode className="h-6 w-6 text-background" />
          </div>
          <CardTitle className="text-xl">Set Up Your Restaurant</CardTitle>
          <CardDescription>
            Create your restaurant profile to start taking orders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Restaurant Name
              </label>
              <Input
                placeholder="e.g. The Olive Garden"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Description <span className="text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                placeholder="A brief description of your restaurant"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={isCreating || !name.trim()}
            >
              {isCreating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create Restaurant
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
