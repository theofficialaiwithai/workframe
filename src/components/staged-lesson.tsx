import { MDXRemote } from "next-mdx-remote/rsc";
import { CodeBlock } from "@/components/code-block";
import { PredictForm } from "@/components/predict-form";
import { Button } from "@/components/ui/button";
import { STAGES, sectionBody, type Section, type StageName } from "@/lib/lesson-stages";
import type { Lesson } from "@/lib/lessons";

function Prose({ source }: { source: string }) {
  return (
    <div className="prose max-w-none text-ink prose-headings:font-heading prose-headings:text-ink prose-a:text-ink prose-strong:text-ink prose-code:font-mono prose-code:before:content-none prose-code:after:content-none">
      <MDXRemote source={source} components={{ pre: CodeBlock }} />
    </div>
  );
}

function Card({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`stage-${n}`} className="rounded-lg border border-border bg-surface p-u3">
      <h2 id={`stage-${n}`} className="flex items-baseline gap-u1 text-xl font-bold">
        <span className="text-sm font-medium text-muted">{n}</span>
        {title}
      </h2>
      <div className="mt-u2">{children}</div>
    </section>
  );
}

/**
 * A v2 lesson as stage cards: Goal, Predict, Run, Investigate, Modify, Make,
 * Check, When it breaks. Until Run is open (a saved prediction, or "skip for
 * now") only Goal and Predict are rendered: the later sections are not in the
 * page at all, not merely hidden.
 */
export function StagedLesson({
  courseSlug,
  lesson,
  sections,
  prediction,
  runOpen,
}: {
  courseSlug: string;
  lesson: Lesson;
  sections: Section[];
  prediction: string | null;
  runOpen: boolean;
}) {
  const body = (name: StageName) => sectionBody(sections, name) ?? "";
  const number = (name: StageName) => STAGES.indexOf(name) + 1;
  const current: StageName = runOpen ? "Run" : "Predict";

  return (
    <div className="space-y-u3">
      <ol aria-label="Lesson stages" className="flex flex-wrap gap-u1">
        {STAGES.map((name) => {
          const unlocked = runOpen || name === "Goal" || name === "Predict";
          return (
            <li
              key={name}
              aria-current={name === current ? "step" : undefined}
              className={`rounded-full border px-u1 py-[5px] text-xs font-medium ${
                name === current
                  ? "border-ink bg-ink text-surface"
                  : unlocked
                    ? "border-border bg-surface text-ink"
                    : "border-border bg-surface-alt text-muted"
              }`}
            >
              {name}
            </li>
          );
        })}
      </ol>

      <Card n={number("Goal")} title="Goal">
        <Prose source={body("Goal")} />
      </Card>

      <Card n={number("Predict")} title="Predict">
        <Prose source={body("Predict")} />
        {prediction ? (
          <div className="mt-u2 rounded-md bg-surface-alt p-u2">
            <p className="text-sm font-bold">Your prediction (saved)</p>
            <p className="mt-u1 whitespace-pre-wrap">{prediction}</p>
          </div>
        ) : (
          <div className="mt-u2">
            <PredictForm
              courseSlug={courseSlug}
              lessonSlug={lesson.slug}
              question={lesson.predict?.question ?? "What do you think will happen?"}
            />
          </div>
        )}
      </Card>

      {!runOpen && (
        <p className="rounded-lg border border-dashed border-border p-u3 text-sm text-muted">
          Next: Run. It opens when you save a prediction, or choose Skip for now.
        </p>
      )}

      {runOpen && (
        <>
          <Card n={number("Run")} title="Run">
            <div className="mb-u2 flex flex-wrap gap-u1">
              {lesson.colabUrl && (
                <Button asChild>
                  <a href={lesson.colabUrl} target="_blank" rel="noopener noreferrer">
                    Open in Colab
                  </a>
                </Button>
              )}
              {lesson.datasetPath && (
                <Button asChild variant="outline">
                  <a href={lesson.datasetPath} download>
                    Download sample data
                  </a>
                </Button>
              )}
            </div>
            {prediction && (
              <div className="mb-u2 rounded-md bg-surface-alt p-u2">
                <p className="text-sm font-bold">Compare with your prediction</p>
                <p className="mt-u1 whitespace-pre-wrap">{prediction}</p>
              </div>
            )}
            <Prose source={body("Run")} />
          </Card>

          <Card n={number("Investigate")} title="Investigate">
            <Prose source={body("Investigate")} />
          </Card>
          <Card n={number("Modify")} title="Modify">
            <Prose source={body("Modify")} />
          </Card>
          <Card n={number("Make")} title="Make">
            <Prose source={body("Make")} />
          </Card>

          <Card n={number("Check")} title="Check">
            {lesson.expected && (
              <div className="mb-u2 rounded-md bg-surface-alt p-u2">
                <p className="text-sm font-bold">Expected output</p>
                <p className="mt-u1">{lesson.expected.description}</p>
                <a
                  href={lesson.expected.sampleOutputPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-u1 inline-flex min-h-tap items-center text-sm font-medium underline"
                >
                  See the sample output
                </a>
              </div>
            )}
            <Prose source={body("Check")} />
          </Card>

          <Card n={number("When it breaks")} title="When it breaks">
            <Prose source={body("When it breaks")} />
            <div className="mt-u2 space-y-u1">
              {(lesson.errors ?? []).map((e) => (
                <details key={e.message} className="rounded-md border border-border bg-surface">
                  <summary className="flex min-h-tap cursor-pointer items-center px-u2 font-mono text-sm font-bold">
                    {e.message}
                  </summary>
                  <div className="space-y-u1 border-t border-border p-u2 text-sm">
                    <p>
                      <strong>Why:</strong> {e.cause}
                    </p>
                    <p>
                      <strong>Fix:</strong> {e.fix}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
