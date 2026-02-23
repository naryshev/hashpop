"use client";

import { useState, useRef, useEffect } from "react";
import { searchCategories } from "../lib/categories";

type CategorySearchProps = {
  value: string;
  onChange: (category: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
};

export function CategorySearch({ value, onChange, placeholder = "Search categories…", className = "", id }: CategorySearchProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = searchCategories(query, 50);
  const showList = open && results.length > 0;

  // Sync query when value is set externally (e.g. duplicate prefill)
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!showList) return;
    setHighlightIndex(0);
  }, [query, showList]);

  useEffect(() => {
    if (!showList || !listRef.current) return;
    const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightIndex, showList]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (category: string) => {
    onChange(category);
    setQuery(category);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showList) {
      if (e.key === "ArrowDown" || e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i + 1) % results.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i - 1 + results.length) % results.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(results[highlightIndex]);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        id={id}
        type="text"
        value={query}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          setOpen(true);
          if (!v.trim()) onChange("");
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="input-frost mt-1 w-full"
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        aria-controls="category-list"
        aria-activedescendant={showList ? `category-option-${highlightIndex}` : undefined}
      />
      {showList && (
        <ul
          id="category-list"
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-white/10 bg-[rgb(63,63,69)] shadow-xl"
        >
          {results.map((cat, i) => (
            <li
              key={cat}
              id={`category-option-${i}`}
              role="option"
              aria-selected={i === highlightIndex}
              className={`cursor-pointer px-3 py-2 text-sm text-white border-b border-white/5 last:border-0 ${
                i === highlightIndex ? "bg-white/15" : "hover:bg-white/10"
              }`}
              onMouseEnter={() => setHighlightIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(cat);
              }}
            >
              {cat}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
