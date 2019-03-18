import React from 'react';
import PropTypes from 'prop-types';
import LoaderInline from '@jetbrains/ring-ui/components/loader-inline/loader-inline';
import {i18n} from 'hub-dashboard-addons/dist/localization';
import EmptyWidget, {EmptyWidgetFaces} from '@jetbrains/hub-widget-ui/dist/empty-widget';
import ConfigurableWidget from '@jetbrains/hub-widget-ui/dist/configurable-widget';
import Calendar from 'react-big-calendar';
import moment from 'moment';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import styles from './app.css';
import EditForm from './edit-form';
import {loadIssues, loadTotalIssuesCount} from './resources';
import ServiceResource from './components/service-resource';

import EventComponent from './issue_event';
import CalendarToolbar from './calendar_toolbar';

const localizer = Calendar.momentLocalizer(moment);
const DEFAULT_SCHEDULE_FIELD = 'Due Date';
const DEFAULT_COLOR_FIELD = 'Priority';

class DueDatesCalendarWidget extends React.Component {
  static propTypes = {
    dashboardApi: PropTypes.object,
    configWrapper: PropTypes.object,
    registerWidgetApi: PropTypes.func
  };

  static DEFAULT_REFRESH_PERIOD = 240; // eslint-disable-line no-magic-numbers


  static digitToUnicodeSuperScriptDigit = digitSymbol => {
    const unicodeSuperscriptDigits = [
      0x2070, 0x00B9, 0x00B2, 0x00B3, 0x2074, // eslint-disable-line no-magic-numbers
      0x2075, 0x2076, 0x2077, 0x2078, 0x2079 // eslint-disable-line no-magic-numbers
    ];
    return String.fromCharCode(unicodeSuperscriptDigits[Number(digitSymbol)]);
  };

  static getIssueListLink = (homeUrl, context, search) => {
    let link = `${homeUrl}/`;
    if (context && context.shortName) {
      link += `issues/${context.shortName.toLowerCase()}`;
    } else if (context && context.$type) {
      if (context.$type.toLowerCase().indexOf('tag') > -1) {
        link += `tag/${context.name.toLowerCase()}-${context.id.split('-').pop()}`;
      } else {
        link += `search/${context.name.toLowerCase()}-${context.id.split('-').pop()}`;
      }
    } else {
      link += 'issues';
    }
    if (search) {
      link += `?q=${encodeURIComponent(search)}`;
    }
    return link;
  };

  static getFullSearchPresentation = (context, search) => [
    context && context.name && `#{${context.name}}`, search
  ].filter(str => !!str).join(' ') || `#${i18n('issues')}`;

    static getDefaultYouTrackService =
        async (dashboardApi, predefinedYouTrack) => {
          if (predefinedYouTrack && predefinedYouTrack.id) {
            return predefinedYouTrack;
          }
          try {
            // TODO: pass min-required version here
            return await ServiceResource.getYouTrackService(
              dashboardApi.fetchHub.bind(dashboardApi)
            );
          } catch (err) {
            return null;
          }
        };

  static youTrackServiceNeedsUpdate = service => !service.name;

  static getDefaultWidgetTitle = () =>
    i18n('Due Dates Calendar Widget');

  static getWidgetTitle =
      (search, context, title, issuesCount, youTrack, scheduleField) => {
        let displayedTitle =
            title ||
            `${DueDatesCalendarWidget.getFullSearchPresentation(context, search)} has: {${scheduleField}}`;
        if (issuesCount) {
          const superScriptIssuesCount =
                `${issuesCount}`.split('').map(DueDatesCalendarWidget.digitToUnicodeSuperScriptDigit).join('');
          displayedTitle += ` ${superScriptIssuesCount}`;
        }
        return {
          text: displayedTitle,
          href: youTrack && DueDatesCalendarWidget.getIssueListLink(
            youTrack.homeUrl, context, `${search} has: {${scheduleField}}`
          )
        };
      };

  constructor(props) {
    super(props);
    const {registerWidgetApi} = props;

    this.state = {
      isConfiguring: false,
      isLoading: true,
      events: [],
      date: new Date()
    };

    registerWidgetApi({
      onConfigure: () => this.setState({
        isConfiguring: true,
        isLoading: false,
        isLoadDataError: false,
        isEmptyQueryResultError: false
      }),
      onRefresh: () => this.loadIssues()
    });
  }

  componentDidMount() {
    this.initialize(this.props.dashboardApi);
  }

  initialize = async dashboardApi => {
    this.setState({isLoading: true});
    await this.props.configWrapper.init();

    const youTrackService =
      await DueDatesCalendarWidget.getDefaultYouTrackService(
        dashboardApi, this.props.configWrapper.getFieldValue('youTrack')
      );


    if (this.props.configWrapper.isNewConfig()) {
      this.initializeNewWidget(youTrackService);
    } else {
      await this.initializeExistingWidget(youTrackService);
    }
  };


  initializeNewWidget(youTrackService) {
    if (youTrackService && youTrackService.id) {
      this.setState({
        isConfiguring: true,
        isNew: true,
        youTrack: youTrackService,
        isLoading: false
      });
    }
    this.setState({isLoadDataError: true, isLoading: false});
  }

  // eslint-disable-next-line complexity
  async initializeExistingWidget(youTrackService) {
    const search = this.props.configWrapper.getFieldValue('search');
    const context = this.props.configWrapper.getFieldValue('context');
    const refreshPeriod =
          this.props.configWrapper.getFieldValue('refreshPeriod');
    const title = this.props.configWrapper.getFieldValue('title');
    const date = this.props.configWrapper.getFieldValue('date');
    const view = this.props.configWrapper.getFieldValue('view');

    let {scheduleField} =
        this.props.configWrapper.getFieldValue('scheduleField');

    if (!scheduleField) {
      scheduleField = DEFAULT_SCHEDULE_FIELD;
    }

    let {colorField} =
          this.props.configWrapper.getFieldValue('colorField');

    if (!colorField) {
      colorField = DEFAULT_COLOR_FIELD;
    }

    this.setState({
      title,
      search: search || '',
      context,
      date: date ? new Date(date) : new Date(),
      view,
      scheduleField,
      colorField,
      refreshPeriod:
        refreshPeriod || DueDatesCalendarWidget.DEFAULT_REFRESH_PERIOD
    });
    await this.showListFromCache(search, context);

    if (youTrackService && youTrackService.id) {
      const onYouTrackSpecified = async () => {
        await this.loadIssues(search, context);
        this.setState({isLoading: false});
      };
      this.setYouTrack(youTrackService, onYouTrackSpecified);
    }
  }

  async showListFromCache(search, context) {
    const {dashboardApi} = this.props;
    const cache = (await dashboardApi.readCache() || {}).result;
    if (cache && cache.search === search &&
      (cache.context || {}).id === (context || {}).id) {
      this.setState({issues: cache.issues, fromCache: true});
    }
  }

  setYouTrack(youTrackService, onAfterYouTrackSetFunction) {
    const {homeUrl} = youTrackService;

    this.setState({
      youTrack: {
        id: youTrackService.id, homeUrl
      }
    }, async () => await onAfterYouTrackSetFunction());

    if (DueDatesCalendarWidget.youTrackServiceNeedsUpdate(youTrackService)) {
      const {dashboardApi} = this.props;
      ServiceResource.getYouTrackService(
        dashboardApi.fetchHub.bind(dashboardApi),
        youTrackService.id
      ).then(
        updatedYouTrackService => {
          const shouldReSetYouTrack = updatedYouTrackService &&
            !DueDatesCalendarWidget.youTrackServiceNeedsUpdate(
              updatedYouTrackService
            ) && updatedYouTrackService.homeUrl !== homeUrl;
          if (shouldReSetYouTrack) {
            this.setYouTrack(
              updatedYouTrackService, onAfterYouTrackSetFunction
            );
            if (!this.state.isConfiguring) {
              this.props.configWrapper.update({
                youTrack: {
                  id: updatedYouTrackService.id,
                  homeUrl: updatedYouTrackService.homeUrl
                }
              });
            }
          }
        }
      );
    }
  }

  submitConfiguration = async formParameters => {
    const {
      search, title, context, refreshPeriod, selectedYouTrack,
      scheduleField, colorField
    } = formParameters;

    this.setYouTrack(
      selectedYouTrack, async () => {
        this.setState(
          {search: search || '',
            context, title, scheduleField, refreshPeriod, colorField},
          async () => {
            await this.loadIssues();
            await this.props.configWrapper.replace({
              search,
              context,
              title,
              refreshPeriod,
              scheduleField,
              colorField,
              youTrack: {
                id: selectedYouTrack.id,
                homeUrl: selectedYouTrack.homeUrl
              }
            });
            this.setState(
              {isConfiguring: false, fromCache: false, isNew: false}
            );
          }
        );
      }
    );
  };

  cancelConfiguration = async () => {
    if (this.state.isNew) {
      await this.props.dashboardApi.removeWidget();
    } else {
      this.setState({isConfiguring: false});
      await this.props.dashboardApi.exitConfigMode();
      this.initialize(this.props.dashboardApi);
    }
  };

  initRefreshPeriod = newRefreshPeriod => {
    if (newRefreshPeriod !== this.state.refreshPeriod) {
      this.setState({refreshPeriod: newRefreshPeriod});
    }

    const millisInSec = 1000;
    setTimeout(async () => {
      const {
        isConfiguring,
        refreshPeriod,
        search,
        context,
        scheduleField
      } = this.state;
      if (!isConfiguring && refreshPeriod === newRefreshPeriod) {
        await this.loadIssues(search, context, scheduleField);
        this.initRefreshPeriod(refreshPeriod);
      }
    }, newRefreshPeriod * millisInSec);
  };

  fetchYouTrack = async (url, params) => {
    const {dashboardApi} = this.props;
    const {youTrack} = this.state;
    return await dashboardApi.fetch(youTrack.id, url, params);
  };

  renderConfiguration = () => (
    <div className={`issues-list-widget ${styles.widget}`}>
      <EditForm
        search={this.state.search}
        context={this.state.context}
        title={this.state.title}
        refreshPeriod={this.state.refreshPeriod}
        scheduleField={this.state.scheduleField || DEFAULT_SCHEDULE_FIELD}
        colorField={this.state.colorField || DEFAULT_COLOR_FIELD}
        onSubmit={this.submitConfiguration}
        onCancel={this.cancelConfiguration}
        dashboardApi={this.props.dashboardApi}
        youTrackId={this.state.youTrack.id}
      />
    </div>
  )

  renderLoadDataError() {
    return (
      <EmptyWidget
        face={EmptyWidgetFaces.ERROR}
        message={i18n('Can\'t load information from service.')}
      />
    );
  }

  renderEmptyQueryResultError() {
    return (
      <EmptyWidget
        face={EmptyWidgetFaces.ERROR}
        message={i18n('No issues corresponding your query, project and schedule field.')}
      />
    );
  }

  async loadIssues(search, context, scheduleField) {
    const currentSearch = search || this.state.search;
    const currentContext = context || this.state.context;
    const currentScheduleField = scheduleField || this.state.scheduleField;
    try {
      await this.loadIssuesCount(`${currentSearch} has: {${currentScheduleField}}`, currentContext);
    } catch (error) {
      this.setState({isEmptyQueryResultError: true, issuesCount: 0});
    }

    await this.loadIssuesUnsafe(
      currentSearch,
      currentContext,
      currentScheduleField);

  }

  renderLoader() {
    return <LoaderInline/>;
  }


  async loadIssuesUnsafe(search, context, scheduleField) {

    const currentDate = moment(this.state.date);
    const issuesQuery = `${search} ${scheduleField}: ${moment(currentDate).format('YYYY-MM')}`;
    const issues = await loadIssues(
      this.fetchYouTrack, issuesQuery, context
    );

    const events = [];
    if (Array.isArray(issues)) {
      issues.forEach(issue => {
        let dueDate = '';
        let foregroundColor = '#9c9c9c';
        let backgroundColor = '#e8e8e8';
        let issuePriority = '';
        let isResolved = false;
        const customFields = [];
        // eslint-disable-next-line complexity
        issue.fields.forEach(field => {
          if (field.hasOwnProperty('projectCustomField') && field.value) {
            if (field.value) {
            // eslint-disable-next-line max-len
              if (field.projectCustomField.field.name === this.state.scheduleField) {
                dueDate = field.value;
              }
              // eslint-disable-next-line max-len
              if (field.projectCustomField.field.name === this.state.colorField) {
                issuePriority = field.value.name;
                foregroundColor = field.value.color.foreground;
                backgroundColor = field.value.color.background;
              } else if (field.value.color) {
                customFields.push({name: field.projectCustomField.field.name,
                  value: field.value.name,
                  foregroundColor: field.value.color.foreground,
                  backgroundColor: field.value.color.background});
              }

              if (field.projectCustomField.field.name === 'State') {
              // eslint-disable-next-line max-len
                isResolved = Boolean(field.value.isResolved);
              }
            } else {
              customFields.push({name: field.projectCustomField.field.name,
                value: 'Undefined',
                foregroundColor: '#fff',
                backgroundColor: '#fff'});
            }
          }
        });

        events.push({
          issueId: issue.idReadable,
          description: `${issue.idReadable} ${issue.summary}`,
          url: `${this.state.youTrack.homeUrl}/issue/${issue.idReadable}`,
          priority: issuePriority,
          isResolved,
          start: (new Date(dueDate)),
          end: (new Date(dueDate)),
          allDay: true,
          foregroundColor,
          backgroundColor,
          customFields
        });
      });
    }
    this.setState({issues, events, fromCache: false, isLoadDataError: false});
    this.props.dashboardApi.storeCache({
      search, context, issues
    });
  }

  async loadIssuesCount(search, context) {
    const issuesCount =
      await loadTotalIssuesCount(
        this.fetchYouTrack, search, context
      );
    this.changeIssuesCount(issuesCount);
  }

  changeIssuesCount = issuesCount => {
    this.setState({issuesCount});
  };

  calendarNavigate = async date => {
    this.setState({date}, this.loadIssues);
    const config = await this.props.dashboardApi.readConfig();
    config.date = date;
    await this.props.dashboardApi.storeConfig(config);
  };

  calendarChangeView = async view => {
    this.setState({view});
    const config = await this.props.dashboardApi.readConfig();
    config.view = view;
    await this.props.dashboardApi.storeConfig(config);
  };

  // eslint-disable-next-line complexity
  renderContent = () => {
    const {
      isConfiguring,
      isLoading,
      fromCache,
      isLoadDataError,
      isEmptyQueryResultError
    } = this.state;

    if (isEmptyQueryResultError) {
      return this.renderEmptyQueryResultError();
    }

    if (isLoadDataError && !fromCache) {
      return this.renderLoadDataError();
    }

    if (isConfiguring) {
      return this.renderConfiguration();
    }

    if (isLoading && !fromCache) {
      return this.renderLoader();
    }

    return (
      <div className={styles.widget}>
        <Calendar
          localizer={localizer}
          defaultDate={this.state.date}
          defaultView={this.state.view}
          events={this.state.events}
          className={styles.calendar}
          views={['month', 'week', 'day']}
          components={
            {
              toolbar: CalendarToolbar,
              event: EventComponent
            }
          }
          onNavigate={this.calendarNavigate}
          onView={this.calendarChangeView}
        />
      </div>
    );
  };

  // eslint-disable-next-line complexity
  render() {
    const {
      isConfiguring,
      search,
      context,
      title,
      issuesCount,
      youTrack,
      scheduleField
    } = this.state;

    const widgetTitle = isConfiguring
      ? DueDatesCalendarWidget.getDefaultWidgetTitle()
      : DueDatesCalendarWidget.getWidgetTitle(
        search, context, title, issuesCount, youTrack, scheduleField
      );

    return (
      <ConfigurableWidget
        isConfiguring={isConfiguring}
        dashboardApi={this.props.dashboardApi}
        widgetTitle={widgetTitle}
        widgetLoader={this.state.isLoading}
        Configuration={this.renderConfiguration}
        Content={this.renderContent}
      />
    );
  }
}

export default DueDatesCalendarWidget;
