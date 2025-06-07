
import React from 'react';

interface CommentsDisplayProps {
  comment?: string | null;
}

const CommentsDisplay: React.FC<CommentsDisplayProps> = ({ comment }) => {
  if (!comment) {
    return null; // Don't render if no comment
  }

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow mt-4">
      <h4 className="font-semibold text-yellow-800 mb-1">Move Comment:</h4>
      <p className="text-sm text-yellow-700 whitespace-pre-wrap">{comment}</p>
    </div>
  );
};

export default CommentsDisplay;
    