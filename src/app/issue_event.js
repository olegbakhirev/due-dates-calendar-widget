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
    }, 'event-style');

    const event = this.props.event;
    const colorsStyle = {
      backgroundColor: event.backgroundColor,
      color: event.foregroundColor,
      borderColor: event.foregroundColor
    };

    return (
      <Tooltip
        popupProps={{top: 0}}
        title={this.props.event.description}
      >
        <a
          className={classes}
          style={colorsStyle}
          href={this.props.event.url}
        >
          {this.props.event.description}
        </a>
      </Tooltip>
    );
  }
}


export default EventComponent;
