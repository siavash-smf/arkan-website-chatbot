import { z } from "zod";

// گزینه‌های مجاز برای فیلدهای انتخابی
export const STAGE_OPTIONS = ["ایده", "نوپا", "در حال رشد", "تثبیت‌شده"] as const;
export const TIME_OPTIONS = ["صبح", "بعدازظهر", "عصر"] as const;

// شماره تماس ایران: ارقام لاتین/فارسی، با امکان فاصله یا خط تیره
const phoneRegex = /^[0-9۰-۹+\-\s()]{8,20}$/;

/**
 * اسکیمای اعتبارسنجی فرم درخواست مشاوره.
 * پیام‌های خطا فارسی و روشن‌اند (طبق برند گاید).
 * همین اسکیما در کلاینت و سرور استفاده می‌شود.
 */
export const leadSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(3, { message: "لطفاً نام و نام خانوادگی خود را وارد کنید." })
    .max(80, { message: "نام واردشده بیش از حد طولانی است." }),

  phone: z
    .string()
    .trim()
    .min(1, { message: "شماره‌ی تماس الزامی است." })
    .regex(phoneRegex, { message: "شماره‌ی تماس معتبر نیست." }),

  email: z
    .string()
    .trim()
    .email({ message: "ایمیل واردشده معتبر نیست." })
    .max(120)
    .optional()
    .or(z.literal("")),

  business_name: z
    .string()
    .trim()
    .min(2, { message: "نام کسب‌وکار را وارد کنید." })
    .max(120),

  industry: z.string().trim().max(120).optional().or(z.literal("")),

  stage: z.enum(STAGE_OPTIONS, {
    errorMap: () => ({ message: "مرحله‌ی کسب‌وکار را انتخاب کنید." }),
  }),

  challenge: z
    .string()
    .trim()
    .min(10, { message: "لطفاً چالش فعلی خود را کمی توضیح دهید (حداقل ۱۰ نویسه)." })
    .max(1500, { message: "توضیح بیش از حد طولانی است." }),

  preferred_time: z
    .enum(TIME_OPTIONS)
    .optional()
    .or(z.literal("")),
});

export type LeadInput = z.infer<typeof leadSchema>;

export type LeadFieldErrors = Partial<Record<keyof LeadInput, string>>;

export type SubmitResult =
  | { ok: true }
  | { ok: false; fieldErrors?: LeadFieldErrors; formError?: string };
