import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import QuestionDashboard from '@/components/QuestionDashboard/QuestionDashboard';
import type { Metadata } from 'next';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Props = {
  params: {
    questionId: string;
  };
};

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  return {
    title: `Question ${params.questionId}`,
  };
};

export default async function DashboardPage(props: Props) {
  // Fetch the question data
  const { data: question, error } = await supabase
    .from('questions')
    .select('*')
    .eq('id', props.params.questionId)
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