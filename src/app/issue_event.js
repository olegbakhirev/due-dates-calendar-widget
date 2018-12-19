import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Tooltip from '@jetbrains/ring-ui/components/tooltip/tooltip';


class EventComponent extends React.Component {
  static propTypes = {
    event: PropTypes.object
  };

  render() {
    const classes = classNames({
      'event-link': true,
      'event-resolved': this.props.event.isResolved
    }, [`event-priority-${this.props.event.priority.toLowerCase()}`]);

    return (
      <Tooltip
        popupProps={{top: 0}}
        title={this.props.event.description}
      >
        <a
          className={classes}
          href={this.props.event.url}
        >
          {this.props.event.description}
        </a>
      </Tooltip>
    );
  }
}


export default EventComponent;
