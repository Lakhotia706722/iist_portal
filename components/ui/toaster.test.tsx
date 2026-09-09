import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, Toaster } from "./toaster";
import { useToast } from "@/hooks/use-toast";

afterEach(cleanup);

/** Stand-in for a real client component performing a mutation. */
function MutationHarness() {
  const { toast } = useToast();
  return (
    <div>
      <button
        onClick={() =>
          toast({
            title: "Offer recorded",
            description: "The offer has been added.",
            variant: "success",
          })
        }
      >
        create
      </button>
      <button
        onClick={() =>
          toast({ title: "Offer updated", description: "Marked Accepted." })
        }
      >
        update
      </button>
      <button
        onClick={() =>
          toast({
            title: "Application withdrawn",
            description: "Removed from the drive.",
            variant: "destructive",
          })
        }
      >
        delete
      </button>
    </div>
  );
}

function renderApp() {
  return render(
    <ToastProvider>
      <MutationHarness />
      <Toaster />
    </ToastProvider>
  );
}

describe("Toaster", () => {
  it("renders nothing until a toast is dispatched", () => {
    renderApp();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a toast for create, update and delete mutations", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByText("create"));
    expect(await screen.findByText("Offer recorded")).toBeInTheDocument();
    expect(screen.getByText("The offer has been added.")).toBeInTheDocument();

    await user.click(screen.getByText("update"));
    expect(await screen.findByText("Offer updated")).toBeInTheDocument();

    await user.click(screen.getByText("delete"));
    expect(await screen.findByText("Application withdrawn")).toBeInTheDocument();

    // All three visible at once, newest last.
    expect(screen.getAllByRole("status")).toHaveLength(3);
  });

  it("marks destructive toasts as assertive for screen readers", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByText("delete"));
    const toast = await screen.findByRole("status");
    expect(toast).toHaveAttribute("aria-live", "assertive");
  });

  it("dismisses a toast when the close button is clicked", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByText("create"));
    expect(await screen.findByText("Offer recorded")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Dismiss notification"));
    expect(screen.queryByText("Offer recorded")).not.toBeInTheDocument();
  });

  it("auto-dismisses after the timeout", async () => {
    vi.useFakeTimers();
    try {
      renderApp();

      // fireEvent, not userEvent — userEvent's own timers deadlock under fake timers.
      fireEvent.click(screen.getByText("create"));
      expect(screen.getByText("Offer recorded")).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(5100);
      });
      expect(screen.queryByText("Offer recorded")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("throws if useToast is used without the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<MutationHarness />)).toThrow(/must be used within/);
    spy.mockRestore();
  });
});
