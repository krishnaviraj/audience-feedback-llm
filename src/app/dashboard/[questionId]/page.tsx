import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import QuestionDashboard from '@/components/QuestionDashboard/QuestionDashboard';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface PageProps {
  params: { questionId: string }
}

const DashboardPage = async ({ params }: PageProps) => {
  // Fetch the question data
  const { data: question, error } = await supabase
    .from('questions')
    .select('*')
    .eq('id', params.questionId)
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

export default DashboardPage;