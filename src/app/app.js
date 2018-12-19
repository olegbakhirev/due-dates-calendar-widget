import 'babel-polyfill';
import DashboardAddons from 'hub-dashboard-addons';
import React from 'react';
import {render} from 'react-dom';

import DueDatesCalendarWidget from './due_dates_calendar_widget';

import 'file-loader?name=[name].[ext]!../../manifest.json'; // eslint-disable-line import/no-unresolved

DashboardAddons.registerWidget(async (dashboardApi, registerWidgetApi) => {

  render(
    <DueDatesCalendarWidget
      dashboardApi={dashboardApi}
      registerWidgetApi={registerWidgetApi}
    />,
    document.getElementById('app-container')
  );
});
