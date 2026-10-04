import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HighlightedText, mergeRanges } from '../src/features/case/HighlightedText.jsx';

describe('HighlightedText', () => {
  it('merges overlapping evidence ranges', () => {
    expect(
      mergeRanges([
        { start: 16, end: 31 },
        { start: 6, end: 31 },
        { start: 40, end: 44 },
      ]),
    ).toEqual([
      { start: 6, end: 31 },
      { start: 40, end: 44 },
    ]);
  });

  it('highlights verified quotes at their exact positions', () => {
    const text = '@alex you are a worthless idiot and nobody cares';
    const { container } = render(
      <HighlightedText
        text={text}
        ranges={[
          { start: 6, end: 31 },
          { start: 16, end: 31 },
        ]}
      />,
    );
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent('you are a worthless idiot');
    expect(container).toHaveTextContent(text);
  });
});
