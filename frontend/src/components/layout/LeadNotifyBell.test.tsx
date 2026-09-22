import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { LeadNotifyBell } from "./LeadNotifyBell";
import * as push from "../../utils/webpush";

vi.mock("../../utils/webpush", () => ({
  pushEnvironment: vi.fn(),
  prepareWebPush: vi.fn(),
  syncExistingPush: vi.fn(),
  enableWebPush: vi.fn(),
  disableWebPush: vi.fn(),
  testWebPush: vi.fn(),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(push.pushEnvironment).mockReturnValue("ready");
  vi.mocked(push.prepareWebPush).mockResolvedValue({} as never);
  vi.mocked(push.syncExistingPush).mockResolvedValue(false);
  vi.mocked(push.enableWebPush).mockResolvedValue(true);
  vi.mocked(push.disableWebPush).mockResolvedValue(undefined);
  vi.mocked(push.testWebPush).mockResolvedValue(undefined);
  vi.stubGlobal("Notification", { permission: "default" });
});
afterEach(() => vi.unstubAllGlobals());

function open() {
  render(<LeadNotifyBell />);
  fireEvent.click(
    screen.getByRole("button", { name: "Уведомления о заявках" }),
  );
}
it("offers installation instructions instead of hiding the bell in iPhone Safari", () => {
  vi.mocked(push.pushEnvironment).mockReturnValue("install-ios");
  open();
  expect(screen.getByText(/«На экран Домой»/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Включить уведомления" }),
  ).not.toBeInTheDocument();
});
it("reports enabled only after the server accepts the subscription", async () => {
  open();
  fireEvent.click(screen.getByRole("button", { name: "Включить уведомления" }));
  await screen.findByText("Включены на этом устройстве");
  expect(push.enableWebPush).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Пробное уведомление" }));
  await waitFor(() => expect(push.testWebPush).toHaveBeenCalledTimes(1));
});
it("shows an error and never claims success on failed registration", async () => {
  vi.mocked(push.enableWebPush).mockRejectedValue(new Error("CRM недоступна"));
  open();
  fireEvent.click(screen.getByRole("button", { name: "Включить уведомления" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("CRM недоступна");
  expect(screen.getByRole("status")).toHaveTextContent("Не включены");
});
it("lets an enabled device unsubscribe", async () => {
  vi.mocked(push.syncExistingPush).mockResolvedValue(true);
  open();
  fireEvent.click(await screen.findByRole("button", { name: "Отключить" }));
  await screen.findByText("Не включены на этом устройстве");
  expect(push.disableWebPush).toHaveBeenCalledTimes(1);
});
