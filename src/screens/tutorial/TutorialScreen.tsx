import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDb } from '../../data/db';
import { setSetting } from '../../data/settings';
import { Confetti } from '../../components/Confetti';
import s from './Tutorial.module.css';

export const TUTORIAL_DONE_KEY = 'tutorialDone';

/** 반짝이는 곳: 눌러도 다음으로 넘어갑니다. */
function Hl({ children, onNext, className = '', label }: { children: ReactNode; onNext: () => void; className?: string; label?: string }) {
  return <button type="button" className={`${s.hl} ${className}`} onClick={onNext} aria-label={label} data-hl="">{children}</button>;
}

const row = (name: string, amount: string, dot = '#8A8A94') => (
  <div className={s.row} key={name}><span><span className={s.dot} style={{ background: dot }} />{name}</span><span className={s.sub}>{amount}</span></div>
);

interface Step { title: string; body: string; screen: (next: () => void) => ReactNode }

/** 13단계(STORYBOARD 3, U10-4). 예시 화면은 그림일 뿐이라 아무것도 저장하지 않습니다. */
export const STEPS: Step[] = [
  {
    title: '대상 추가', body: '처음에는 기타만 있어요. + 대상 추가를 눌러 좋아하는 대상을 등록해요. 반짝이는 곳을 눌러도 다음으로 넘어가요.',
    screen: (n) => <><h2 className={s.h}>기록</h2>{row('기타', '0원')}<Hl onNext={n}>+ 대상 추가</Hl></>,
  },
  {
    title: '이름과 프리셋', body: '이름을 넣고 프리셋을 고르면 분류와 세부가 한 번에 들어가요. 프리셋은 설정에서 직접 만들어요. 가수 A는 예시라 저장되지 않아요.',
    screen: (n) => (
      <div className={s.sheet}>
        <h2 className={s.h}>새 대상</h2>
        <div className={s.input}>가수 A</div>
        <div className={s.chips}><span className={`${s.chip} ${s.chipOn}`}>가수용</span><span className={s.chip}>배우용</span><span className={s.chip}>취미용</span></div>
        <Hl onNext={n} className={s.wide}>추가</Hl>
      </div>
    ),
  },
  {
    title: '대상 고르기', body: '기록할 때는 대상을 눌러요. 옆 금액은 이번 달에 쓴 돈이에요. 편집을 누르면 순서와 이름을 바꾸거나 지울 수 있어요.',
    screen: (n) => <><h2 className={s.h}>기록</h2><Hl onNext={n} className={s.rowHl}><span><span className={s.dot} style={{ background: '#D9487A' }} />가수 A</span><span className={s.sub}>0원</span></Hl>{row('기타', '0원')}</>,
  },
  {
    title: '분류 고르기', body: '이어서 분류를 골라요. 분류마다 이번 달 금액이 보여요.',
    screen: (n) => <><h2 className={s.h}>어디에 썼나요?</h2><Hl onNext={n} className={s.rowHl}><span>행사</span><span className={s.sub}>0원</span></Hl>{['체험', '경비', '상품', '멤버십', '기타'].map((x) => row(x, '0원'))}</>,
  },
  {
    title: '세부 고르기', body: '세부를 고르거나 건너뛰어요. 건너뛰면 그 분류의 기타로 저장돼요.',
    screen: (n) => <><h2 className={s.h}>자세히 고를까요?</h2><Hl onNext={n} className={s.rowHl}><span>콘서트</span><span className={s.sub}>0원</span></Hl>{['팬미팅', '팝업', '기타'].map((x) => row(x, '0원'))}<span className={s.ghost}>건너뛰기</span></>,
  },
  {
    title: '금액 넣고 저장', body: '금액을 넣고 저장하면 첫 화면으로 돌아가요. 날짜는 바꿀 수 있고, 매달 나가는 돈은 매달 반복을 켜 두면 전날 알려 줘요.',
    screen: (n) => <><span className={s.sub}>가수 A › 행사 › 콘서트</span><p className={s.amount}>154,000원</p>{row('날짜', '오늘')}{row('매달 반복', '꺼짐')}<Hl onNext={n} className={s.wide}>저장</Hl></>,
  },
  {
    title: '내역 보기', body: '내역 탭에서 지난 기록을 대상과 기간으로 골라 봐요. 기록을 누르면 내용을 보여 줘요.',
    screen: (n) => <><h2 className={s.h}>내역</h2><div className={s.chips}><span className={`${s.chip} ${s.chipOn}`}>전체</span><span className={s.chip}>이번 달</span></div><Hl onNext={n} className={s.rowHl} label="방금 기록"><span>가수 A<br /><small className={s.sub}>행사 › 콘서트</small></span><span>154,000원</span></Hl></>,
  },
  {
    title: '수정하기', body: '기록은 처음에 보기만 돼요. 고치려면 오른쪽 위 수정을 눌러요.',
    screen: (n) => <><div className={s.between}><h2 className={s.h}>기록 상세</h2><Hl onNext={n}>수정</Hl></div>{row('대상', '가수 A')}{row('분류', '행사 › 콘서트')}{row('금액', '154,000원')}</>,
  },
  {
    title: '환불 넣기', body: '돌려받은 돈은 환불 칸에 넣고 저장해요. 집계 금액이 알아서 바뀌어요. 삭제도 수정 중에만 보여요.',
    screen: (n) => <><h2 className={s.h}>기록 수정</h2>{row('결제', '154,000원')}<Hl onNext={n} className={s.rowHl}><span>환불</span><span className={s.sub}>0원</span></Hl><span className={s.ghost}>저장</span></>,
  },
  {
    title: '통계 보기', body: '통계 탭에서 월과 연을 바꾸고, ‹로 지난 기간도 봐요.',
    screen: (n) => <><h2 className={s.h}>통계</h2><Hl onNext={n} className={s.seg}><span className={s.segOn}>월</span><span>연</span></Hl><p className={s.amount}>154,000원</p>{row('1위 대상', '가수 A')}</>,
  },
  {
    title: '응원법 외우기', body: '가사를 붙여넣고 편집에서 떼창을 색칠하거나 응원을 넣어요. 외우기 모드에서는 가려 놓고 연습해요.',
    screen: (n) => <><h2 className={s.h}>곡 1</h2><Hl onNext={n} className={s.seg}><span className={s.segOn}>응원법</span><span>원본</span><span>외우기</span></Hl><p className={s.lyric}>둘째 줄 <mark style={{ background: '#FFE08A' }}>다 같이 부르는 부분</mark></p><p className={s.lyric}><mark style={{ background: '#FFD3DE' }}>「 하나 둘 셋 」</mark></p></>,
  },
  {
    title: '테마 꾸미기', body: '설정의 테마에서 라이트와 흑백 중에 고르거나 사진으로 테마를 만들어요. 글자색과 글꼴도 바꾸고, 대상마다 사진을 넣을 수 있어요.',
    screen: (n) => <><h2 className={s.h}>테마와 꾸미기</h2><div className={s.cards}><Hl onNext={n} className={s.card}>라이트</Hl><span className={s.card}>흑백</span><span className={s.card}>+ 사진으로</span></div></>,
  },
  {
    title: '이제 시작해 볼까요?', body: '준비는 끝났어요! 예시는 모두 지웠어요. 좋아하는 대상을 하나 추가하면서 나만의 기록을 시작해 보세요.',
    screen: () => <><h2 className={s.h}>기록</h2>{row('기타', '0원')}<span className={s.ghost}>+ 대상 추가</span></>,
  },
];

/** 튜토리얼(U10-4). 끝내거나 건너뛰면 표시해 두고, 그다음에 기본 프리셋 창이 한 번 나옵니다. */
export function TutorialScreen() {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [fire, setFire] = useState(0);
  const last = i === STEPS.length - 1;
  const step = STEPS[i];
  const go = (k: number) => {
    const to = Math.max(0, Math.min(STEPS.length - 1, k));
    setI(to);
    if (to === STEPS.length - 1 && i !== to) setFire((f) => f + 1);
  };
  const finish = async () => {
    await setSetting(getDb(), TUTORIAL_DONE_KEY, true);
    navigate('/', { replace: true });
  };

  return (
    <div className={s.wrap}>
      <Confetti fire={fire} />
      <div className={s.mock} aria-label={`예시 화면: ${step.title}`} role="region">
        {step.screen(() => go(i + 1))}
      </div>
      <div className={s.guide} role="dialog" aria-modal="false" aria-labelledby="tut-title">
        <p className={s.count}>{i + 1} / {STEPS.length}</p>
        <h2 id="tut-title" className={s.gTitle}>{step.title}</h2>
        <p className={s.gBody}>{step.body}</p>
        {!last && (
          <div className={s.gBtns}>
            <button type="button" className={s.skip} onClick={() => void finish()}>건너뛰기</button>
            <span className={s.spacer} />
            <button type="button" className={s.prev} disabled={i === 0} onClick={() => go(i - 1)}>이전</button>
            <button type="button" className={s.next} onClick={() => go(i + 1)}>다음</button>
          </div>
        )}
      </div>
      {last && <button type="button" className={s.start} onClick={() => void finish()}>시작하기</button>}
    </div>
  );
}
