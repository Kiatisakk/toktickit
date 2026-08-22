import { useNavigate } from "react-router";

import { AppShell } from "../components/AppShell";
import { Button } from "../components/Button";
import { StateBlock } from "../components/StateBlock";

export const NotFound = () => {
  const navigate = useNavigate();

  return (
    <AppShell>
      <h1 className="tkt-page-title">Page not found</h1>
      <StateBlock
        action={
          <Button onClick={() => navigate("/my-tickets")} variant="primary">
            Go to My Tickets
          </Button>
        }
        description="The address you followed does not match any screen in TokTickIT."
        kind="error"
        title="Nothing here"
      />
    </AppShell>
  );
};
