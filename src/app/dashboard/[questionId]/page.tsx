import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import QuestionDashboard from '@/components/QuestionDashboard/QuestionDashboard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function DashboardPage({
  params,
}: {
  params: { [key: string]: string | string[] }
}) {
  const questionId = typeof params.questionId === 'string' ? params.questionId : params.questionId[0];

  // Fetch the question data
  const { data: question, error } = await supabase
    .from('questions')
    .select('*')
    .eq('id', questionId)
    .single();

  if (error || !question) {
    return notFound();
  }

  return (
    <QuestionDashboard 
      questionId={question.id}
      question={question.question}
    />
  );
}