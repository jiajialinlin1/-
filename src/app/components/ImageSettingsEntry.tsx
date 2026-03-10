import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import {
  grantImageSettingsAccess,
  hasImageSettingsAccess,
  IMAGE_SETTINGS_ENTRY_LABEL,
  IMAGE_SETTINGS_ROUTE,
} from "../config/imageSettingsAccess";
import { verifySharedContentAccess } from "../config/sharedContentApi";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export function ImageSettingsEntry() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword("");
      setError("");
    }
  }, [open]);

  if (location.pathname === IMAGE_SETTINGS_ROUTE) return null;

  const handleTriggerClick = () => {
    if (hasImageSettingsAccess()) {
      navigate(IMAGE_SETTINGS_ROUTE);
      return;
    }

    setOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!password.trim()) {
      setError("请输入访问密码。");
      return;
    }

    setSubmitting(true);

    const result = await verifySharedContentAccess(password);
    if (!result.ok) {
      setError(result.errorMessage || "密码不正确，请重试。");
      setSubmitting(false);
      return;
    }

    grantImageSettingsAccess(password);
    setOpen(false);
    navigate(IMAGE_SETTINGS_ROUTE);
    setSubmitting(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleTriggerClick}
        title="进入内容设置"
        aria-label="进入内容设置"
        className="inline-flex items-center gap-2 rounded-full border border-[#d2d2d7] px-4 py-2 text-sm font-medium text-[#86868b] transition-colors hover:border-[#c7c7cc] hover:bg-white hover:text-[#1d1d1f]"
      >
        <LockKeyhole size={14} />
        {IMAGE_SETTINGS_ENTRY_LABEL}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[420px] rounded-[28px] border-0 bg-white p-0 shadow-[0_24px_80px_rgba(0,0,0,0.18)] overflow-hidden">
          <div className="bg-[linear-gradient(135deg,#f5f5f7_0%,#ffffff_58%,#f3f4f6_100%)] px-6 py-6 md:px-8 md:py-8">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-bold tracking-tight text-[#1d1d1f]">
                内容设置入口
              </DialogTitle>
              <DialogDescription className="text-base leading-7 text-[#86868b]">
                输入访问密码后进入内容设置页面。
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="px-6 pb-6 md:px-8 md:pb-8">
            <div className="space-y-3">
              <label
                htmlFor="image-settings-password"
                className="block text-sm font-medium text-[#55565c]"
              >
                访问密码
              </label>
              <Input
                id="image-settings-password"
                type="password"
                autoFocus
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError("");
                }}
                placeholder="请输入密码"
                className="h-12 rounded-2xl border-[#e5e5ea] bg-[#f8f8fa] px-4 text-base text-[#1d1d1f] placeholder:text-[#a0a0a5] focus-visible:border-[#1d1d1f] focus-visible:ring-black/5"
              />
              <p className={`text-sm ${error ? "text-[#d44747]" : "text-[#86868b]"}`}>
                {error || "密码正确后将跳转到内容设置页。"}
              </p>
            </div>

            <DialogFooter className="mt-6 sm:justify-between">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-[#d2d2d7] px-5 py-2.5 text-sm font-medium text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7]"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-[#1d1d1f] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-black"
              >
                {submitting ? "校验中..." : "进入"}
                <ArrowRight size={16} />
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
