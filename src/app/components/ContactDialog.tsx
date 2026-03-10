import { useState, type ReactNode } from "react";
import { Check, Copy, Phone, Mail, MessageCircleMore } from "lucide-react";
import { CONTACT_INFO } from "../config/contactInfo";
import { getPersonalInfoSettings } from "../config/personalInfoSettings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function getContactIcon(contactId: string) {
  switch (contactId) {
    case "phone":
      return Phone;
    case "email":
      return Mail;
    case "wechat":
      return MessageCircleMore;
    default:
      return Copy;
  }
}

export function ContactDialog({ trigger }: { trigger: ReactNode }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const personalInfoSettings = getPersonalInfoSettings();
  const contactItems = [
    { id: "phone", label: "电话", value: personalInfoSettings.phone },
    { id: "email", label: "邮箱", value: personalInfoSettings.email },
    { id: "wechat", label: "微信", value: CONTACT_INFO.wechat },
  ];

  const handleCopy = async (contactId: string, value: string) => {
    try {
      await copyToClipboard(value);
      setCopiedId(contactId);
      window.setTimeout(() => {
        setCopiedId((currentId) => (currentId === contactId ? null : currentId));
      }, 1800);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-[560px] rounded-[28px] border-0 bg-white p-0 shadow-[0_24px_80px_rgba(0,0,0,0.18)] overflow-hidden">
        <div className="bg-[linear-gradient(135deg,#f5f5f7_0%,#ffffff_58%,#f3f4f6_100%)] px-6 py-6 md:px-8 md:py-8">
          <DialogHeader className="text-left">
            <DialogTitle className="text-2xl md:text-3xl font-bold tracking-tight text-[#1d1d1f]">
              联系我
            </DialogTitle>
            <DialogDescription className="text-base leading-7 text-[#86868b]">
              你可以通过电话、邮箱或微信联系我。点击右侧按钮即可快速复制。
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6 md:px-8 md:pb-8">
          <div className="space-y-3">
            {contactItems.map((item) => {
              const Icon = getContactIcon(item.id);
              const isCopied = copiedId === item.id;

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-[22px] border border-[#ececf1] bg-[#f8f8fa] px-4 py-4"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1d1d1f] shadow-sm">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#86868b]">{item.label}</p>
                    <p className="mt-1 truncate text-lg font-semibold text-[#1d1d1f]">
                      {item.value}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopy(item.id, item.value)}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                      isCopied
                        ? "bg-[#1d1d1f] text-white"
                        : "bg-white text-[#1d1d1f] hover:bg-[#1d1d1f] hover:text-white"
                    }`}
                  >
                    {isCopied ? <Check size={16} /> : <Copy size={16} />}
                    {isCopied ? "已复制" : "复制"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
