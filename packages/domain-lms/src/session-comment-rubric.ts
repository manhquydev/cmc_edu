/** Post-session comment rubric. Keys match Prisma `Program`. SoR: docs/session-comment-rubric.csv */


export const RUBRIC_PROGRAMS = ['UCREA', 'BRIGHT_IG', 'BLACK_HOLE'] as const;
export type RubricProgramId = (typeof RUBRIC_PROGRAMS)[number];

export const NARRATIVE_MAX_CHARS = 2000;
export type RubricScore = 1 | 2 | 3 | 4;

export type CriterionGroup = 'attitude' | 'knowledge' | 'skill';

export type CriterionDef = {
  key: string;
  group: CriterionGroup;
  labelVi: string;
  bands: Record<RubricScore, string>;
  helpers: Record<RubricScore, string>;
};

export type NarrativeKey = 'strength' | 'weakness' | 'recommendation';

export type NarrativeDef = {
  key: NarrativeKey;
  labelVi: string;
  maxChars: number;
};

export type RubricProgram = {
  program: RubricProgramId;
  criteria: CriterionDef[];
  narratives: NarrativeDef[];
};

export type RubricPayload = {
  version: 2;
  scores: Record<string, RubricScore>;
  narratives?: Partial<Record<NarrativeKey, string>>;
};

const NARRATIVES: NarrativeDef[] = [
  { key: 'strength', labelVi: 'Điểm mạnh', maxChars: NARRATIVE_MAX_CHARS },
  { key: 'weakness', labelVi: 'Điểm yếu', maxChars: NARRATIVE_MAX_CHARS },
  { key: 'recommendation', labelVi: 'Đề xuất từ giáo viên', maxChars: NARRATIVE_MAX_CHARS },
];

function criterion(
  key: string,
  group: CriterionGroup,
  labelVi: string,
  bands: Record<RubricScore, string>,
  helpers: Record<RubricScore, string>,
): CriterionDef {
  return { key, group, labelVi, bands, helpers };
}

const SHARED: CriterionDef[] = [
  criterion(
    'attendanceAttitude',
    'attitude',
    'Thái độ đi học',
    {
      1: 'Thường xuyên muộn',
      2: 'Thi thoảng muộn',
      3: 'Đúng giờ, nghỉ có phép',
      4: 'Đi học đầy đủ',
    },
    {
      1: 'Học sinh đến muộn thường xuyên không báo trước, nghỉ học quá số buổi quy định',
      2: 'Học sinh thi thoảng đến muộn, nghỉ học có xin phép',
      3: 'Học sinh đến đúng giờ, nghỉ học có phép theo quy định',
      4: 'Học sinh đi học đúng giờ và đầy đủ',
    },
  ),
  criterion(
    'inClassAttitude',
    'attitude',
    'Thái độ trong giờ học',
    {
      1: 'Cần đồng hành sát sao',
      2: 'Đang hoà nhập',
      3: 'Hợp tác tốt',
      4: 'Thủ lĩnh đồng đội',
    },
    {
      1: 'Học sinh còn ngần ngại, từ chối tham gia các hoạt động nhóm. Cần cô giáo nhắc nhở và khích lệ nhiều trong các hoạt động của lớp',
      2: 'Học sinh tham gia hoạt động nhóm nhưng còn thụ động; đôi lúc còn muốn làm theo ý mình hoặc giữ giáo cụ riêng; cần cô nhắc nhở để phối hợp với bạn.',
      3: 'Học sinh vui vẻ tham gia vào nhóm được phân công; tôn trọng lượt nói của bạn; sẵn sàng chia sẻ đồ dùng học tập; cùng nhóm hoàn thành nhiệm vụ mà không tranh cãi.',
      4: 'Chủ động lắng nghe ý kiến của bạn; biết phân công công việc khi làm bài nhóm; kiên nhẫn giải thích cho bạn chưa hiểu; chủ động chia sẻ giáo cụ và khen ngợi bạn.',
    },
  ),
  criterion(
    'priorKnowledge',
    'knowledge',
    'Kiến thức bài cũ',
    {
      1: 'Cần ôn tập lại',
      2: 'Ghi nhớ cơ bản',
      3: 'Thành thạo',
      4: 'Xuất sắc',
    },
    {
      1: 'Học sinh quên kiến thức buổi trước; chưa làm bài tập về nhà; gặp khó khăn ngay cả khi cô đã đưa ra gợi ý trực quan.',
      2: 'Học sinh nhớ được khái niệm/hình ảnh bài cũ nhưng thao tác còn chậm; cần cô đặt câu hỏi dẫn dắt mới nhớ ra quy luật/cách giải; bài tập về nhà làm chưa hoàn chỉnh.',
      3: 'Học sinh nhớ và làm đúng kiến thức bài cũ; biết cách giải nhưng cần cô gợi ý nhẹ nếu muốn giải thích chi tiết; làm bài tập về nhà đầy đủ.',
      4: 'Học sinh làm đúng/hoàn thành trọn vẹn bài tập; tự tin lên bảng hoặc giải thích cho cô/bạn hiểu tại sao chọn cách giải đó; ứng dụng linh hoạt vào dạng bài biến tấu.',
    },
  ),
  criterion(
    'newKnowledge',
    'knowledge',
    'Kiến thức bài mới',
    {
      1: 'Cần rèn luyện',
      2: 'Hiểu và thao tác',
      3: 'Làm chủ bài mới',
      4: 'Sáng tạo mở rộng',
    },
    {
      1: 'Học sinh gặp khó khăn trong việc tiếp thu khái niệm mới; chưa tự làm được bài tập thực hành nếu không có giáo viên cầm tay chỉ việc hoặc hướng dẫn trực tiếp từng bước.',
      2: 'Học sinh hiểu được kiến thức cơ bản khi cô giảng; giải được bài tập mẫu nhưng cần 1–2 lời gợi ý/dẫn dắt của giáo viên khi gặp bài biến tấu nhẹ; thao tác còn hơi chậm.',
      3: 'Học sinh hiểu rõ bản chất khái niệm mới; tự lực hoàn thành tốt các bài tập thực hành chuẩn mà không cần sự trợ giúp của giáo viên; thao tác giáo cụ/sơ đồ chuẩn xác.',
      4: 'Học sinh nắm bắt khái niệm mới cực nhanh; tự giải được các bài toán biến tấu/nâng cao; biết vận dụng kiến thức mới để tìm ra nhiều hơn 1 cách giải hoặc tự đặt ra bài toán tương tự.',
    },
  ),
];

const UCREA_SKILLS: CriterionDef[] = [
  criterion(
    'basicThinking',
    'skill',
    'Tư duy cơ bản',
    { 1: 'Cần rèn luyện', 2: 'Đang phát triển', 3: 'Nhận thức tốt', 4: 'Nhạy bén' },
    {
      1: 'Quan sát vội; ghi nhớ kém; chú ý dưới 5 phút.',
      2: 'Quan sát tổng quan; nhớ 1–2 yếu tố; tập trung khoảng 10 phút.',
      3: 'Nhận diện đặc điểm cốt lõi; tái hiện 3–4 yếu tố; chú ý 15–20 phút.',
      4: 'Phát hiện chi tiết ẩn; nhớ chuỗi 4–6 bước; tập trung 20–30 phút.',
    },
  ),
  criterion(
    'logicalThinking',
    'skill',
    'Tư duy logic',
    { 1: 'Đang nhận biết', 2: 'Logic cơ bản', 3: 'Linh hoạt', 4: 'Xuất sắc' },
    {
      1: 'Nhận biết quy luật đơn giản; đôi khi suy luận theo cảm tính.',
      2: 'Cần câu hỏi gợi mở; kết nối 2–3 dữ kiện.',
      3: 'Áp dụng thành thạo phương pháp vừa học vào bài tương tự.',
      4: 'Lập luận chặt; giải thích vì sao đáp án đúng; giải bài mới chưa gặp.',
    },
  ),
  criterion(
    'mathThinking',
    'skill',
    'Tư duy toán học',
    { 1: 'Cần rèn luyện', 2: 'Khá', 3: 'Tốt', 4: 'Vượt trội' },
    {
      1: 'Giải được dạng toán cơ bản; tư duy chưa sâu.',
      2: 'Vận dụng kiến thức cho bài lồng 2–3 yêu cầu.',
      3: 'Giải bài nhiều dữ liệu; vận dụng số, hình, logic.',
      4: 'Giải bài vượt trội; linh hoạt và tối ưu.',
    },
  ),
  criterion(
    'creativeThinking',
    'skill',
    'Tư duy sáng tạo',
    { 1: 'Trung bình', 2: 'Khá', 3: 'Linh hoạt', 4: 'Đột phá' },
    {
      1: 'Phụ thuộc bài mẫu; ngại đổi phương pháp khi đề lạ.',
      2: 'Giải theo cách quen; thử góc mới khi được gợi ý.',
      3: 'Biết chuyển hướng tư duy; liên tưởng vào tình huống thực tế.',
      4: 'Tự tìm 2–3 cách giải; tự đặt bài toán tương tự.',
    },
  ),
];

const BRIGHT_SKILLS: CriterionDef[] = [
  criterion(
    'focusObserve',
    'skill',
    'Tập trung - quan sát',
    { 1: 'Cần rèn luyện', 2: 'Hiểu và làm theo mẫu', 3: 'Chủ động hợp tác', 4: 'Xuất sắc' },
    {
      1: 'Khó duy trì tập trung; quan sát qua loa; cần nhắc nhở.',
      2: 'Tập trung thời gian ngắn; quan sát thông tin chính khi có nhắc.',
      3: 'Tập trung tốt; quan sát kỹ các chi tiết cần thiết.',
      4: 'Tập trung và quan sát nhanh; phát hiện chi tiết nhỏ chưa được gợi ý.',
    },
  ),
  criterion(
    'logicAnalyze',
    'skill',
    'Logic - phân tích',
    { 1: 'Cần rèn luyện', 2: 'Cần gợi ý', 3: 'Thông hiểu', 4: 'Tư duy tốt' },
    {
      1: 'Khó xác định mối liên hệ; cần nhiều hướng dẫn.',
      2: 'Nhận biết quy luật đơn giản khi có gợi ý.',
      3: 'Phân tích thông tin, tìm quy luật và cách giải phù hợp.',
      4: 'Suy luận linh hoạt; so sánh và đưa ra nhiều hướng giải.',
    },
  ),
  criterion(
    'initiativeApply',
    'skill',
    'Chủ động - vận dụng',
    { 1: 'Cần hỗ trợ', 2: 'Biết thực hiện', 3: 'Tự chủ', 4: 'Linh hoạt' },
    {
      1: 'Chờ giáo viên hướng dẫn; chưa chủ động đưa ra cách làm.',
      2: 'Tự làm nhiệm vụ quen sau khi được hướng dẫn.',
      3: 'Chủ động chọn và vận dụng kiến thức vào tình huống mới.',
      4: 'Chủ động tìm tòi; kết hợp nhiều kiến thức khi tình huống đổi.',
    },
  ),
  criterion(
    'persistCreate',
    'skill',
    'Kiên trì - sáng tạo',
    { 1: 'Cần cố gắng', 2: 'Có cố gắng', 3: 'Kiên trì thực hiện', 4: 'Chủ động sáng tạo' },
    {
      1: 'Dễ nản khi gặp việc khó; phụ thuộc hỗ trợ.',
      2: 'Có cố gắng nhưng dễ bỏ cuộc; bước đầu có cách làm riêng.',
      3: 'Kiên trì thử nghiệm; mạnh dạn đưa ra ý tưởng.',
      4: 'Thử nhiều cách; điều chỉnh khi chưa thành công; tạo ý tưởng mới.',
    },
  ),
];

const BLACK_HOLE_SKILLS: CriterionDef[] = [
  criterion(
    'logicAnalyze',
    'skill',
    'Logic - phân tích',
    { 1: 'Cần rèn luyện', 2: 'Nhận biết', 3: 'Biết suy luận', 4: 'Suy luận linh hoạt' },
    {
      1: 'Khó nhận biết đặc điểm, mối quan hệ; cần hướng dẫn từng bước.',
      2: 'Nhận biết đặc điểm hoặc quy luật đơn giản khi có gợi ý.',
      3: 'Quan sát, so sánh và tìm quy luật; tự giải nhiệm vụ vừa sức.',
      4: 'Kết hợp nhiều thông tin; phát hiện quy luật mới; chọn cách tối ưu.',
    },
  ),
  criterion(
    'initiativeApply',
    'skill',
    'Chủ động - vận dụng',
    { 1: 'Cần hỗ trợ', 2: 'Biết thực hiện', 3: 'Tự thực hiện', 4: 'Vận dụng linh hoạt' },
    {
      1: 'Thụ động; chờ cô hướng dẫn; chưa vận dụng kiến thức đã học.',
      2: 'Làm nhiệm vụ quen khi được gợi ý; bước đầu áp dụng tình huống tương tự.',
      3: 'Chủ động tham gia; tự hoàn thành; chọn cách làm phù hợp.',
      4: 'Chủ động tìm cách giải; vận dụng vào tình huống mới; tự điều chỉnh.',
    },
  ),
  criterion(
    'persistCreate',
    'skill',
    'Kiên trì - sáng tạo',
    { 1: 'Cần khuyến khích', 2: 'Có cố gắng', 3: 'Kiên trì thực hiện', 4: 'Chủ động sáng tạo' },
    {
      1: 'Dễ mất hứng hoặc bỏ dở; chờ cô hỗ trợ thay vì thử lại.',
      2: 'Cố gắng khi được động viên; thử lại nhưng đôi lúc vẫn nản.',
      3: 'Theo đuổi đến khi xong; thử lại hoặc đổi cách; bước đầu có ý tưởng riêng.',
      4: 'Thử nhiều cách; mạnh dạn ý tưởng mới và phát triển theo ý mình.',
    },
  ),
  criterion(
    'tacticalThinking',
    'skill',
    'Tư duy chiến thuật',
    { 1: 'Cần hướng dẫn', 2: 'Biết thử nghiệm', 3: 'Có chiến thuật', 4: 'Tối ưu chiến thuật' },
    {
      1: 'Hành động theo cảm tính; chưa biết làm gì trước; cần hướng dẫn trực tiếp.',
      2: 'Làm theo một cách chơi đơn giản khi được mẫu hoặc nhắc.',
      3: 'Cân nhắc cách thực hiện để đạt mục tiêu; bước đầu đổi cách khi chưa đạt.',
      4: 'Dự đoán kết quả đơn giản; chọn cách chơi phù hợp và điều chỉnh theo tình huống.',
    },
  ),
  criterion(
    'presentDebate',
    'skill',
    'Thuyết trình - phản biện',
    { 1: 'Ngại chia sẻ', 2: 'Biết trả lời', 3: 'Chủ động trình bày', 4: 'Tự tin trình bày' },
    {
      1: 'E dè; ít chủ động trả lời; câu ngắn; cần câu hỏi gợi mở.',
      2: 'Trả lời câu quen; nói về cách làm khi được gợi ý.',
      3: 'Chủ động chia sẻ; trình bày tương đối rõ; lắng nghe và phản hồi.',
      4: 'Mạnh dạn trình bày; giải thích lý do; đồng tình hoặc không đồng tình có lý do.',
    },
  ),
];

export const SESSION_COMMENT_RUBRIC: Record<RubricProgramId, RubricProgram> = {
  UCREA: { program: 'UCREA', criteria: [...SHARED, ...UCREA_SKILLS], narratives: NARRATIVES },
  BRIGHT_IG: { program: 'BRIGHT_IG', criteria: [...SHARED, ...BRIGHT_SKILLS], narratives: NARRATIVES },
  BLACK_HOLE: { program: 'BLACK_HOLE', criteria: [...SHARED, ...BLACK_HOLE_SKILLS], narratives: NARRATIVES },
};

export function isRubricProgram(value: unknown): value is RubricProgramId {
  return value === 'UCREA' || value === 'BRIGHT_IG' || value === 'BLACK_HOLE';
}

export function rubricFor(program: RubricProgramId): RubricProgram {
  return SESSION_COMMENT_RUBRIC[program];
}

export function criterionKeys(program: RubricProgramId): string[] {
  return SESSION_COMMENT_RUBRIC[program].criteria.map((item) => item.key);
}

export function isScore(value: unknown): value is RubricScore {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export function coerceScore(value: unknown): RubricScore | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return isScore(n) ? n : null;
}

export function isCompleteScores(program: RubricProgramId, scores: Record<string, unknown> | null | undefined): boolean {
  if (!scores) return false;
  const keys = criterionKeys(program);
  if (Object.keys(scores).length !== keys.length) return false;
  return keys.every((key) => isScore(scores[key]));
}

export function safeParseRubric(value: unknown): RubricPayload | null {
  if (!value || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  if (rec.version !== 2) return null;
  if (!rec.scores || typeof rec.scores !== 'object') return null;
  const scores: Record<string, RubricScore> = {};
  for (const [key, raw] of Object.entries(rec.scores as Record<string, unknown>)) {
    const score = coerceScore(raw);
    if (!score) return null;
    scores[key] = score;
  }
  const narratives: Partial<Record<NarrativeKey, string>> = {};
  const rawNarr = rec.narratives && typeof rec.narratives === 'object' ? (rec.narratives as Record<string, unknown>) : {};
  for (const key of ['strength', 'weakness', 'recommendation'] as const) {
    const text = rawNarr[key];
    if (typeof text === 'string' && text.trim()) narratives[key] = text.trim();
  }
  return { version: 2, scores, narratives };
}

export function formatBand(criterionDef: CriterionDef, score: RubricScore): string {
  return `${score} — ${criterionDef.bands[score]}`;
}

/** Confirmed session comment: complete v2 scores, or legacy non-empty content with no rubric. */
export function isSessionCommentSatisfied(
  program: RubricProgramId,
  content: string,
  rubric: unknown,
): boolean {
  const parsed = safeParseRubric(rubric);
  if (parsed) return isCompleteScores(program, parsed.scores);
  return content.trim().length > 0;
}

export function synthesizeRubricContent(program: RubricProgramId, payload: RubricPayload): string {
  const catalog = rubricFor(program);
  const lines: string[] = [];
  for (const criterionDef of catalog.criteria) {
    const score = payload.scores[criterionDef.key];
    if (score) lines.push(`${criterionDef.labelVi}: ${formatBand(criterionDef, score)}`);
  }
  const n = payload.narratives ?? {};
  if (n.strength) lines.push(`Điểm mạnh: ${n.strength}`);
  if (n.weakness) lines.push(`Điểm yếu: ${n.weakness}`);
  if (n.recommendation) lines.push(`Đề xuất từ giáo viên: ${n.recommendation}`);
  return lines.join('\n');
}
