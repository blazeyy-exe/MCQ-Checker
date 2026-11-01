interface Props {
  src: string;
  alt: string;
}

export function AnnotatedPaper({ src, alt }: Props) {
  return (
    <div className="overflow-hidden rounded-3xl border border-rule bg-white shadow-sm">
      <img src={src} alt={alt} className="w-full" />
    </div>
  );
}
