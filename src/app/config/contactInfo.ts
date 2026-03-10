export const CONTACT_INFO = {
  phone: "17794764416",
  email: "smaolin2846@gmail.com",
  wechat: "sml2846499028l",
} as const;

export const CONTACT_ITEMS = [
  { id: "phone", label: "电话", value: CONTACT_INFO.phone },
  { id: "email", label: "邮箱", value: CONTACT_INFO.email },
  { id: "wechat", label: "微信", value: CONTACT_INFO.wechat },
] as const;
