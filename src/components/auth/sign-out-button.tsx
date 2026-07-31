import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";

export function SignOutButton(props: ComponentProps<typeof Button>) {
  return (
    <form action="/api/logout" method="POST">
      <Button type="submit" {...props} />
    </form>
  );
}
