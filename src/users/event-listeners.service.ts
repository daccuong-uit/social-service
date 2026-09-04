import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { EventBusService, DomainEvent, isUserCreatedEvent } from '@platform/common';
import { UsersService } from './users.service';

/**
 * Event Listeners for User Domain Events
 * Subscribes to and handles user-related events from other services
 */
@Injectable()
export class UserEventListenersService implements OnModuleInit {
  private logger = new Logger('UserEventListenersService');

  constructor(
    private readonly eventBus: EventBusService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Initialize event subscriptions on module load
   */
  async onModuleInit(): Promise<void> {
    this.logger.debug('Initializing user event listeners...');
    await this.subscribeToEvents();
  }

  /**
   * Subscribe to all user events
   */
  private async subscribeToEvents(): Promise<void> {
    // Subscribe to user.created event
    await this.eventBus.subscribe('user.created.v1', async (event: DomainEvent) => {
      if (isUserCreatedEvent(event)) {
        await this.handleUserCreated(event);
      }
    });

    this.logger.log('User event listeners registered');
  }

  /**
   * Handle user.created.v1 event
   * Creates a UserProfile in social-service when user is created in auth-service
   */
  private async handleUserCreated(event: any): Promise<void> {
    try {
      const { userId, username, displayName } = event.payload;

      this.logger.debug('Handling user.created event', { userId, event_id: event.event_id });

      // Create user profile
      await this.usersService.createUserProfile({
        userId,
        username,
        displayName,
      });

      this.logger.log('User profile created from event', {
        userId,
        event_id: event.event_id,
      });
    } catch (error) {
      this.logger.error('Failed to handle user.created event', {
        event_id: event.event_id,
        error,
      });
      // Note: In production, might want to save to dead-letter queue or retry
    }
  }
}
