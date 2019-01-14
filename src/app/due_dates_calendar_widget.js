import React from 'react';
import PropTypes from 'prop-types';
import LoaderInline from '@jetbrains/ring-ui/components/loader-inline/loader-inline';
import {i18n} from 'hub-dashboard-addons/dist/localization';
import EmptyWidget, {EmptyWidgetFaces} from '@jetbrains/hub-widget-ui/dist/empty-widget';
import Calendar from 'react-big-calendar';
import moment from 'moment';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import styles from './app.css';
import EditForm from './edit-form';
import {loadIssues} from './resources';
import ServiceResource from './components/service-resource';

import EventComponent from './issue_event';
import CalendarToolbar from './calendar_toolbar';

const localizer = Calendar.momentLocalizer(moment);

class DueDatesCalendarWidget extends React.Component {
  static propTypes = {
    dashboardApi: PropTypes.object,
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

  static getDefaultYouTrackService = async (dashboardApi, config) => {
    if (config && config.youTrack && config.youTrack.id) {
      return config.youTrack;
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
        isLoadDataError: false
      }),
      onRefresh: () => this.loadIssues()
    });
  }

  componentDidMount() {
    this.initialize(this.props.dashboardApi);
  }

  initialize = async dashboardApi => {
    this.setLoadingEnabled(true);
    const config = await dashboardApi.readConfig();
    const {search, context, title, refreshPeriod, date, view} = (config || {});
    const isNew = !config;

    if (!isNew) {
      this.changeSearch(search, context);
      await this.showListFromCache(search, context);
    }

    this.initRefreshPeriod(
      refreshPeriod || DueDatesCalendarWidget.DEFAULT_REFRESH_PERIOD
    );

    // eslint-disable-next-line max-len
    const youTrackService = await DueDatesCalendarWidget.getDefaultYouTrackService(dashboardApi, config);

    if (youTrackService && youTrackService.id) {
      const onYouTrackSpecified = async () => {
        if (isNew) {
          dashboardApi.enterConfigMode();
          this.setState({isConfiguring: true, isNew});
        } else {
          this.changeTitle(title);
          this.setState({date: date ? new Date(date) : new Date(), view});
          await this.loadIssues(search, context);
        }
        this.setLoadingEnabled(false);
      };
      this.setYouTrack(youTrackService, onYouTrackSpecified);
    } else {
      this.setState({isLoadDataError: true});
      this.setState({date});
      this.setLoadingEnabled(false);
    }
  };

  setLoadingEnabled(isLoading) {
    this.props.dashboardApi.setLoadingAnimationEnabled(isLoading);
    this.setState({isLoading});
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
              dashboardApi.storeConfig({
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
      search, title, context, refreshPeriod, selectedYouTrack
    } = formParameters;
    this.setYouTrack(
      selectedYouTrack, async () => {
        this.initRefreshPeriod(refreshPeriod);
        this.changeSearch(
          search, context, async () => {
            this.changeTitle(title);
            await this.loadIssues();
            await this.props.dashboardApi.storeConfig({
              search,
              context,
              title,
              refreshPeriod,
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
        context
      } = this.state;
      if (!isConfiguring && refreshPeriod === newRefreshPeriod) {
        await this.loadIssues(search, context);
        this.initRefreshPeriod(refreshPeriod);
      }
    }, newRefreshPeriod * millisInSec);
  };

  changeSearch = (search, context, onChangeSearchCallback) => {
    this.setState(
      {search: search || '', context},
      async () => onChangeSearchCallback && await onChangeSearchCallback()
    );
  };

  changeTitle = title => {
    this.setState(
      {title}, () => this.updateTitle()
    );
  };


  fetchYouTrack = async (url, params) => {
    const {dashboardApi} = this.props;
    const {youTrack} = this.state;
    return await dashboardApi.fetch(youTrack.id, url, params);
  };

  updateTitle = () => {
    const {search, context, title, issuesCount, youTrack} = this.state;
    let displayedTitle =
      title ||
      DueDatesCalendarWidget.getFullSearchPresentation(context, search);
    if (issuesCount) {
      const superScriptIssuesCount =
        `${issuesCount}`.split('').map(DueDatesCalendarWidget.digitToUnicodeSuperScriptDigit).join('');
      displayedTitle += ` ${superScriptIssuesCount}`;
    }
    this.props.dashboardApi.setTitle(
      displayedTitle,
      DueDatesCalendarWidget.getIssueListLink(youTrack.homeUrl, context, search)
    );
  };

  renderConfiguration() {
    return (
      <div className={`issues-list-widget ${styles.widget}`}>
        <EditForm
          search={this.state.search}
          context={this.state.context}
          title={this.state.title}
          refreshPeriod={this.state.refreshPeriod}
          onSubmit={this.submitConfiguration}
          onCancel={this.cancelConfiguration}
          dashboardApi={this.props.dashboardApi}
          youTrackId={this.state.youTrack.id}
        />
      </div>
    );
  }

  renderLoadDataError() {
    return (
      <EmptyWidget
        face={EmptyWidgetFaces.ERROR}
        message={i18n('Can\'t load information from service.')}
      />
    );
  }

  async loadIssues(search, context) {
    try {
      await this.loadIssuesUnsafe(search, context);
    } catch (error) {
      this.setState({isLoadDataError: true});
    }
  }

  renderLoader() {
    return <LoaderInline/>;
  }


  async loadIssuesUnsafe(search, context) {
    const currentSearch = search || this.state.search;
    const currentContext = context || this.state.context;

    const currentDate = moment(this.state.date);
    const issuesQuery = `${currentSearch} Due Date: ${moment(currentDate).format('YYYY-MM')}`;

    const issues = await loadIssues(
      this.fetchYouTrack, issuesQuery, currentContext
    );

    const events = [];
    if (Array.isArray(issues)) {
      issues.forEach(issue => {
        let hasDueDate = false;
        let dueDate = '';
        let issuePriority = 'NotDefined';
        let isResolved = false;
        issue.fields.forEach(field => {
          if (field.hasOwnProperty('projectCustomField')) {
            if (field.projectCustomField.field.name === 'Due Date') {
              hasDueDate = true;
              dueDate = field.value;
            }
            if (field.projectCustomField.field.name === 'Priority') {
              issuePriority = field.value.name;
            }
            if (field.projectCustomField.field.name === 'State') {
              isResolved = Boolean(field.value.isResolved);
            }
          }
        });
        if (hasDueDate) {
          events.push({
            issueId: issue.idReadable,
            description: `${issue.idReadable} ${issue.summary}`,
            url: `${this.state.youTrack.homeUrl}/issue/${issue.idReadable}`,
            priority: issuePriority,
            isResolved,
            start: (new Date(dueDate)),
            end: (new Date(dueDate)),
            allDay: true
          });
        }
        return hasDueDate;
      });
    }
    this.setState({issues, events, fromCache: false, isLoadDataError: false});
    this.props.dashboardApi.storeCache({
      search: currentSearch, context: currentContext, issues
    });
  }

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
  render() {
    const {
      isConfiguring,
      isLoading,
      fromCache,
      isLoadDataError
    } = this.state;

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
          style={{height: '100vh'}}
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
  }
}

export default DueDatesCalendarWidget;
