import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Shield,
  UserX,
  UserCheck,
  Plus,
  Trash2,
  ChevronDown,
  Mail,
  Phone,
} from "lucide-react";

const ROLE_CONFIG = {
  owner: {
    label: "Owner",
    color: "bg-purple-50 text-purple-700 border-purple-200",
    icon: Shield,
    description: "Full access to all features and settings",
  },
  manager: {
    label: "Manager",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: Shield,
    description: "Can manage menu, orders, and tables",
  },
  staff: {
    label: "Staff",
    color: "bg-gray-50 text-gray-600 border-gray-200",
    icon: Users,
    description: "Can view and update order statuses",
  },
} as const;

type Role = "owner" | "manager" | "staff";

export function StaffManager({
  restaurantId,
}: {
  restaurantId: Id<"restaurants">;
}) {
  const staffMembers = useQuery(api.staff.getByRestaurant, { restaurantId });
  const addStaff = useMutation(api.staff.addByRestaurant);
  const updateRole = useMutation(api.staff.updateRole);
  const deactivateStaff = useMutation(api.staff.deactivate);
  const activateStaff = useMutation(api.staff.activate);
  const removeStaff = useMutation(api.staff.remove);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "staff" as Role,
  });
  const [isAdding, setIsAdding] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState<Id<"staff"> | null>(null);
  const [newRole, setNewRole] = useState<Role>("staff");

  if (!staffMembers) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading staff...
      </div>
    );
  }

  const activeStaff = staffMembers.filter((s) => s.isActive);
  const inactiveStaff = staffMembers.filter((s) => !s.isActive);

  const handleAddStaff = async () => {
    if (!addForm.name.trim() || !addForm.email.trim()) return;
    setIsAdding(true);
    try {
      await addStaff({
        restaurantId,
        name: addForm.name.trim(),
        email: addForm.email.trim(),
        phone: addForm.phone.trim() || undefined,
        role: addForm.role,
      });
      setShowAddDialog(false);
      setAddForm({ name: "", email: "", phone: "", role: "staff" });
    } catch (err) {
      console.error("Failed to add staff:", err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRoleChange = async (staffId: Id<"staff">) => {
    await updateRole({ id: staffId, role: newRole });
    setShowRoleDialog(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Staff Management</h2>
          <p className="text-sm text-muted-foreground">
            Add team members and manage their access levels.
          </p>
        </div>
        <Button
          size="sm"
          className="cursor-pointer bg-orange-500 hover:bg-orange-600 text-white"
          onClick={() => setShowAddDialog(true)}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Staff
        </Button>
      </div>

      {/* Role Info */}
      <Card className="bg-gradient-to-r from-orange-50/50 to-amber-50/50 border-orange-100">
        <CardContent className="p-4">
          <h3 className="text-sm font-medium mb-3 text-gray-900">Access Levels</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            {Object.entries(ROLE_CONFIG).map(([key, config]) => {
              const RoleIcon = config.icon;
              return (
                <div
                  key={key}
                  className="flex items-start gap-2 p-2 rounded-lg bg-white/80"
                >
                  <Badge
                    variant="outline"
                    className={`text-[10px] mt-0.5 ${config.color}`}
                  >
                    <RoleIcon className="mr-1 h-3 w-3" />
                    {config.label}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    {config.description}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Active Staff */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Active Staff ({activeStaff.length})
        </h3>
        {activeStaff.length === 0 ? (
          <Card className="border-dashed border-orange-200">
            <CardContent className="py-8 text-center">
              <Users className="mx-auto mb-3 h-8 w-8 text-orange-300" />
              <p className="text-sm text-muted-foreground mb-3">
                No staff members added yet.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer border-orange-200 text-orange-600 hover:bg-orange-50"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Your First Staff Member
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="divide-y rounded-xl border border-orange-100 bg-white">
            {activeStaff.map((member) => {
              const config = ROLE_CONFIG[member.role];
              const RoleIcon = config.icon;

              return (
                <div
                  key={member._id}
                  className="flex items-center gap-4 p-4 hover:bg-orange-50/30 transition-colors"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-amber-400 text-white text-sm font-bold">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {member.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] cursor-pointer hover:opacity-80 ${config.color}`}
                        onClick={() => {
                          setNewRole(member.role);
                          setShowRoleDialog(member._id);
                        }}
                      >
                        <RoleIcon className="mr-1 h-3 w-3" />
                        {config.label}
                        <ChevronDown className="ml-0.5 h-3 w-3" />
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {member.email}
                      </span>
                      {member.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {member.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {member.role !== "owner" && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer h-8 w-8 p-0 text-amber-600 hover:bg-amber-50"
                          onClick={() => deactivateStaff({ id: member._id })}
                          title="Deactivate"
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                          onClick={() => removeStaff({ id: member._id })}
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
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
          <div className="divide-y rounded-xl border border-gray-200 bg-white opacity-70">
            {inactiveStaff.map((member) => {
              const config = ROLE_CONFIG[member.role];
              const RoleIcon = config.icon;

              return (
                <div
                  key={member._id}
                  className="flex items-center gap-4 p-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500 text-sm font-bold">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        {member.name}
                      </span>
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
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {member.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50"
                      onClick={() => activateStaff({ id: member._id })}
                      title="Reactivate"
                    >
                      <UserCheck className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer h-8 w-8 p-0 text-red-500 hover:bg-red-50"
                      onClick={() => removeStaff({ id: member._id })}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Staff Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. John Doe"
                value={addForm.name}
                onChange={(e) =>
                  setAddForm({ ...addForm, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                placeholder="e.g. john@example.com"
                value={addForm.email}
                onChange={(e) =>
                  setAddForm({ ...addForm, email: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Phone <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                type="tel"
                placeholder="e.g. +1 234 567 890"
                value={addForm.phone}
                onChange={(e) =>
                  setAddForm({ ...addForm, phone: e.target.value })
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Role</label>
              <div className="grid grid-cols-3 gap-2">
                {(["staff", "manager", "owner"] as Role[]).map((role) => {
                  const config = ROLE_CONFIG[role];
                  const RoleIcon = config.icon;
                  return (
                    <button
                      key={role}
                      className={`p-3 rounded-xl border-2 transition-all cursor-pointer text-center ${
                        addForm.role === role
                          ? "border-orange-400 bg-orange-50"
                          : "border-gray-200 hover:border-orange-200"
                      }`}
                      onClick={() => setAddForm({ ...addForm, role })}
                    >
                      <RoleIcon
                        className={`h-5 w-5 mx-auto mb-1 ${
                          addForm.role === role
                            ? "text-orange-500"
                            : "text-gray-400"
                        }`}
                      />
                      <span
                        className={`text-xs font-semibold ${
                          addForm.role === role
                            ? "text-orange-600"
                            : "text-gray-600"
                        }`}
                      >
                        {config.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowAddDialog(false)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-orange-500 hover:bg-orange-600 text-white"
              onClick={handleAddStaff}
              disabled={
                isAdding || !addForm.name.trim() || !addForm.email.trim()
              }
            >
              {isAdding ? "Adding..." : "Add Staff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog
        open={!!showRoleDialog}
        onOpenChange={() => setShowRoleDialog(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(["staff", "manager", "owner"] as Role[]).map((role) => {
              const config = ROLE_CONFIG[role];
              const RoleIcon = config.icon;
              return (
                <button
                  key={role}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer text-left ${
                    newRole === role
                      ? "border-orange-400 bg-orange-50"
                      : "border-gray-200 hover:border-orange-200"
                  }`}
                  onClick={() => setNewRole(role)}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      newRole === role
                        ? "bg-orange-500 text-white"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    <RoleIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{config.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {config.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setShowRoleDialog(null)}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer bg-orange-500 hover:bg-orange-600 text-white"
              onClick={() => showRoleDialog && handleRoleChange(showRoleDialog)}
            >
              Save Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
