export function Doc({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy-900">{title}</h1>
      <div className="mt-6 space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-navy-900 [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </article>
  )
}
