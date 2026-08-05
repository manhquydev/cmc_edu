/**
 * Deep FullCalendar integration (v6) per https://fullcalendar.io/docs/llms.txt
 *
 * Implements (standard plugins only — no Scheduler premium):
 * - ES6/React init (docs: initialize-es6, react)
 * - headerToolbar / buttonText / views (toolbar, view-api)
 * - dayGrid + timeGrid + list (month-view, timegrid-view, list-view)
 * - view-specific options (view-specific-options)
 * - firstDay, locale, weekNumbers (localization, week-numbers)
 * - businessHours, nowIndicator, navLinks
 * - slotMin/MaxTime, scrollTime, slotDuration (time-axis)
 * - dayMaxEvents + moreLink popover (event-popover)
 * - events as function + lazy range filter (events-function, lazyFetching)
 * - eventContent injection (content-injection, event-render-hooks)
 * - dateClick, datesSet, eventClick (date-clicking, datesSet, event-click)
 * - eventInteractive (accessibility)
 * - Calendar API via ref (Calendar-getApi, date-navigation)
 * - fixedWeekCount / showNonCurrentDates (month)
 * - editable false (no drag until product API)
 */
import { useCallback, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type {
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventInput,
  EventSourceFuncArg,
} from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import viLocale from '@fullcalendar/core/locales/vi';
import './soft-ops-fullcalendar.css';

export type SoftOpsFcView =
  | 'dayGridWeek'
  | 'dayGridMonth'
  | 'timeGridWeek'
  | 'timeGridDay'
  | 'listWeek'
  | 'listMonth';

export interface SoftOpsFullCalendarProps {
  events: EventInput[];
  initialView?: SoftOpsFcView;
  /** Remount when external Soft Ops mode changes (list/kanban vs calendar body). */
  viewKey?: string;
  /**
   * Blocking first load only — unmounts FC when true **and** there are no events.
   * Never use for range refetch (would reset currentDate to today).
   */
  loading?: boolean;
  /**
   * Soft in-place fetch (range change). Calendar stays mounted; slight opacity + status.
   */
  fetching?: boolean;
  /** docs: height — entire calendar incl. toolbar */
  height?: number | 'auto' | string;
  /** docs: contentHeight — view area only */
  contentHeight?: number | 'auto' | string;
  /** docs: aspectRatio — width/height when height not fixed */
  aspectRatio?: number;
  onEventNavigate?: (href: string) => void;
  /** docs: datesSet — when visible range changes */
  onDatesSet?: (info: DatesSetArg) => void;
  /** docs: dateClick — day/time cell click */
  onDateClick?: (info: DateClickArg) => void;
  className?: string;
  /** Show FC standard view switchers (month/week dayGrid/week time/list). */
  showFcViewButtons?: boolean;
}

function renderEventContent(arg: EventContentArg) {
  // docs: content-injection / eventContent — React nodes allowed
  const status = String((arg.event.extendedProps as { status?: string })?.status ?? '');
  return (
    <div className="o-fc-ev-inner" title={arg.event.title}>
      {arg.timeText ? <span className="o-fc-ev-time">{arg.timeText}</span> : null}
      <span className="o-fc-ev-title">{arg.event.title}</span>
      {status ? <span className="o-fc-ev-status">{status}</span> : null}
    </div>
  );
}

/**
 * FullCalendar deep embed for CMC schedule.
 * Visual chrome = FC standard (see soft-ops-fullcalendar.css).
 */
export function SoftOpsFullCalendar({
  events,
  initialView = 'dayGridMonth',
  viewKey,
  loading,
  fetching,
  height = 'auto',
  contentHeight,
  aspectRatio = 1.5,
  onEventNavigate,
  onDatesSet,
  onDateClick,
  className,
  showFcViewButtons = true,
}: SoftOpsFullCalendarProps) {
  const calendarRef = useRef<FullCalendar | null>(null);

  const plugins = useMemo(
    () => [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
    [],
  );

  // docs: events (as a function) — filter to visible range (lazy display)
  const eventsFn = useCallback(
    (info: EventSourceFuncArg, success: (events: EventInput[]) => void) => {
      const rangeStart = info.start.valueOf();
      const rangeEnd = info.end.valueOf();
      const filtered = events.filter((ev) => {
        const s = ev.start ? new Date(ev.start as string | Date).valueOf() : 0;
        const e = ev.end
          ? new Date(ev.end as string | Date).valueOf()
          : s + 86_400_000;
        return s < rangeEnd && e > rangeStart;
      });
      success(filtered);
    },
    [events],
  );

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const href = (arg.event.extendedProps as { href?: string } | undefined)?.href;
      // Same-origin relative paths only (defense-in-depth; adapter hardcodes relative href).
      if (href && onEventNavigate && href.startsWith('/') && !href.startsWith('//')) {
        arg.jsEvent.preventDefault();
        onEventNavigate(href);
      }
    },
    [onEventNavigate],
  );

  const handleDateClick = useCallback(
    (info: DateClickArg) => {
      onDateClick?.(info);
      // docs: date navigation — drill to day timeGrid when clicking a date
      const api = calendarRef.current?.getApi();
      if (api && info.allDay) {
        api.changeView('timeGridDay', info.date);
      }
    },
    [onDateClick],
  );

  // Blocking skeleton only when parent has nothing to show yet.
  // Never tear down FC for range refetch — remount drops currentDate back to today.
  const blockingLoad = Boolean(loading) && events.length === 0;
  if (blockingLoad) {
    return (
      <div
        className={['o-fc', 'o-fc-loading', className].filter(Boolean).join(' ')}
        role="status"
        data-testid="soft-ops-fullcalendar"
        data-fc-loading="1"
      >
        Đang tải lịch…
      </div>
    );
  }

  return (
    <div
      className={['o-fc', fetching ? 'o-fc-fetching' : '', className].filter(Boolean).join(' ')}
      data-testid="soft-ops-fullcalendar"
      data-fc-view={initialView}
      data-fc-loading="0"
      data-fc-fetching={fetching ? '1' : '0'}
      data-event-count={events.length}
      aria-busy={fetching ? true : undefined}
    >
      {fetching ? (
        <div className="o-fc-fetching-bar" role="status">
          Đang cập nhật lịch…
        </div>
      ) : null}
      <FullCalendar
        ref={calendarRef}
        key={viewKey ?? initialView}
        plugins={plugins}
        initialView={initialView}
        // —— International (docs: localization) ——
        locale={viLocale}
        firstDay={1}
        direction="ltr"
        // —— Toolbar (docs: headerToolbar, buttons) ——
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: showFcViewButtons
            ? 'dayGridMonth,dayGridWeek,timeGridWeek,timeGridDay,listWeek'
            : '',
        }}
        buttonText={{
          today: 'Hôm nay',
          month: 'Tháng',
          week: 'Tuần',
          day: 'Ngày',
          list: 'Danh sách',
        }}
        // —— Views + view-specific options ——
        views={{
          dayGridMonth: {
            dayMaxEvents: true,
            fixedWeekCount: false,
            showNonCurrentDates: true,
          },
          dayGridWeek: {
            dayMaxEvents: true,
          },
          timeGridWeek: {
            allDaySlot: true,
            allDayText: 'Cả ngày',
            slotMinTime: '07:00:00',
            slotMaxTime: '21:00:00',
            scrollTime: '07:00:00',
            slotDuration: '00:30:00',
            slotLabelInterval: '01:00:00',
            expandRows: true,
            nowIndicator: true,
          },
          timeGridDay: {
            allDaySlot: true,
            allDayText: 'Cả ngày',
            slotMinTime: '07:00:00',
            slotMaxTime: '21:00:00',
            scrollTime: '07:00:00',
            slotDuration: '00:30:00',
            nowIndicator: true,
          },
          listWeek: {
            listDayFormat: { weekday: 'long', day: 'numeric', month: 'short' },
            listDayAltFormat: { year: 'numeric' },
          },
        }}
        // —— Sizing (docs: height, contentHeight, aspectRatio) ——
        height={height}
        contentHeight={contentHeight}
        aspectRatio={contentHeight || height !== 'auto' ? undefined : aspectRatio}
        // —— Date display ——
        weekends={true}
        weekNumbers={true}
        weekNumberCalculation="ISO"
        weekText="Tuần"
        navLinks={true}
        nowIndicator={true}
        // —— Business hours (docs: business-hours) — school-ish window ——
        businessHours={{
          daysOfWeek: [1, 2, 3, 4, 5, 6],
          startTime: '07:30',
          endTime: '20:30',
        }}
        // —— Events (docs: event-model, event-display, event-popover) ——
        events={eventsFn}
        lazyFetching={true}
        eventDisplay="block"
        displayEventTime={true}
        displayEventEnd={false}
        dayMaxEvents={true}
        moreLinkClick="popover"
        moreLinkText="thêm"
        eventOrder="start,-duration,allDay,title"
        eventInteractive={true}
        eventContent={renderEventContent}
        // —— Interaction (docs: event-dragging off; date-clicking) ——
        editable={false}
        eventStartEditable={false}
        eventDurationEditable={false}
        selectable={false}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        datesSet={onDatesSet}
        // —— A11y (docs: accessibility) ——
        // eventInteractive already true; titles via buttonHints defaults + locale
      />
    </div>
  );
}
