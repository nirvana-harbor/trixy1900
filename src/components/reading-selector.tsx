import Image from "next/image";
import { type CSSProperties } from "react";

type PublicOption = {
  reading_date?: string;
  option_key: "A" | "B" | "C" | "D";
  option_title: string;
  cards_json?: string;
  final_text: string;
  indicator_text?: string;
  indicator_style?: string;
  image_filename?: string | null;
  image_src?: string | null;
  image_alt?: string | null;
};

function optionImageSrc(option: PublicOption) {
  if (option.image_src) {
    return option.image_src;
  }

  if (!option.image_filename || !option.reading_date) {
    return null;
  }

  return `/reading-images/${encodeURIComponent(option.reading_date)}/${encodeURIComponent(option.option_key)}`;
}

export function ReadingSelector({ options }: { options: PublicOption[] }) {
  const selectorId = `reading-selector-${(
    options[0]?.reading_date ?? "daily"
  ).replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  if (!options.length) {
    return null;
  }

  return (
    <section className="reading-selector grid gap-5">
      {options.map((option, index) => (
        <input
          key={option.option_key}
          id={`${selectorId}-${option.option_key}`}
          className="reading-choice-input"
          type="radio"
          name={selectorId}
          defaultChecked={index === 0}
        />
      ))}

      <div
        className="option-grid grid gap-3"
        style={{ "--option-count": Math.min(options.length, 4) } as CSSProperties}
      >
        {options.map((option) => {
          const imageSrc = optionImageSrc(option);
          const indicatorText = option.indicator_text?.trim();
          return (
            <label
              key={option.option_key}
              htmlFor={`${selectorId}-${option.option_key}`}
              className="panel option-card option-card-label grid gap-3 p-4 text-left transition"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-2xl font-black">{option.option_key}</span>
                <span className="text-xs font-bold text-[var(--muted)]">选择</span>
              </span>
              <span className="option-image-frame">
                {imageSrc ? (
                  <Image
                    src={imageSrc}
                    alt={option.image_alt || `${option.option_key} 组指示物`}
                    fill
                    sizes="(min-width: 640px) 25vw, 100vw"
                    unoptimized
                  />
                ) : indicatorText ? (
                  <span className="option-text-indicator">{indicatorText}</span>
                ) : (
                  <span className="card-back h-24 w-16" aria-hidden="true" />
                )}
              </span>
              <span className="text-base font-black">{option.option_title}</span>
              <span className="text-sm text-[var(--muted)]">点击查看这组选项</span>
            </label>
          );
        })}
      </div>

      <div className="option-results">
        {options.map((option) => (
          <article
            key={option.option_key}
            className="panel reading-panel option-result p-5 sm:p-7"
          >
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[rgba(47,118,109,0.12)] px-3 py-1 text-sm font-black text-[var(--jade)]">
                {option.option_key} 组
              </span>
              <h2 className="text-xl font-black">{option.option_title}</h2>
            </div>
            {option.indicator_text ? (
              <p className="mb-5 rounded-lg border border-[var(--line)] bg-white/5 p-4 text-sm leading-7 text-[var(--muted)]">
                指示物：{option.indicator_text}
              </p>
            ) : null}
            <p className="reading-text text-[15px] sm:text-base">{option.final_text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
