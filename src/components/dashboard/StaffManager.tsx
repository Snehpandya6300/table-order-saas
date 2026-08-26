import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Shield, UserX, UserCheck } from "lucide-react";

const ROLE_CONFIG = {
  owner: {
    label: "Owner",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    icon: Shield,
  },
  manager: {
    label: "Manager",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Shield,
  },
  staff: {
    label: "Staff",
    color: "bg-gray-50 text-gray-600 border-gray-200",
    icon: Users,
  },
} as const;

export function StaffManager({
  restaurantId,
}: {
  restaurantId: Id<"restaurants">;
}) {
  const staffMembers = useQuery(api.staff.getByRestaurant, { restaurantId });
  const deactivateStaff = useMutation(api.staff.deactivate);
  const activateStaff = useMutation(api.staff.activate);
  const removeStaff = useMutation(api.staff.remove);

  if (!staffMembers) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading staff...
      </div>
    );
  }

  const activeStaff = staffMembers.filter((s) => s.isActive);
  const inactiveStaff = staffMembers.filter((s) => !s.isActive);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Staff</h2>
        <p className="text-sm text-muted-foreground">
          Manage your team members and their access levels.
        </p>
      </div>

      {/* Role Info */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium mb-2">Access Levels</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[10px] ${ROLE_CONFIG.owner.color}`}>
                <Shield className="mr-1 h-3 w-3" />
                Owner
              </Badge>
              <span className="text-xs text-muted-foreground">
                Full access to all features and settings
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[10px] ${ROLE_CONFIG.manager.color}`}>
                <Shield className="mr-1 h-3 w-3" />
                Manager
              </Badge>
              <span className="text-xs text-muted-foreground">
                Can manage menu, orders, and tokens
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={`text-[10px] ${ROLE_CONFIG.staff.color}`}>
                <Users className="mr-1 h-3 w-3" />
                Staff
              </Badge>
              <span className="text-xs text-muted-foreground">
                Can view and update order statuses
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Staff */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Active Staff ({activeStaff.length})
        </h3>
        {activeStaff.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No staff members added yet. Staff accounts are created when
                users sign up and are assigned to your restaurant.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="divide-y rounded-lg border">
            {activeStaff.map((member) => {
              const config = ROLE_CONFIG[member.role];
              const RoleIcon = config.icon;

              return (
                <div key={member._id} className="flex items-center gap-4 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{member.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${config.color}`}
                      >
                        <RoleIcon className="mr-1 h-3 w-3" />
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {member.role !== "owner" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer h-7 w-7 p-0 text-amber-600"
                          onClick={() => deactivateStaff({ id: member._id })}
                          title="Deactivate"
                        >
                          <UserX className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer h-7 w-7 p-0 text-destructive"
                          onClick={() => removeStaff({ id: member._id })}
                          title="Remove"
                        >
                          ×
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inactive Staff */}
      {inactiveStaff.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Inactive ({inactiveStaff.length})
          </h3>
          <div className="divide-y rounded-lg border">
            {inactiveStaff.map((member) => {
              const config = ROLE_CONFIG[member.role];
              const RoleIcon = config.icon;

              return (
                <div key={member._id} className="flex items-center gap-4 p-3 opacity-60">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{member.name}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${config.color}`}
                      >
                        <RoleIcon className="mr-1 h-3 w-3" />
                        {config.label}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        Inactive
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer h-7 w-7 p-0 text-emerald-600"
                      onClick={() => activateStaff({ id: member._id })}
                      title="Reactivate"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer h-7 w-7 p-0 text-destructive"
                      onClick={() => removeStaff({ id: member._id })}
                      title="Remove"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
