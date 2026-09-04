import { MenuItemConfigDto } from '../../friendship/dto/friendship.dto';

const changeRelationshipMenu: MenuItemConfigDto = {
  id: 'change-relationship',
  label: 'Đổi mối quan hệ',
  hasSubmenu: true,
  submenuItems: [
    { id: 'CLOSE_FRIEND', label: 'Bạn thân' },
    { id: 'LOVER', label: 'Người yêu' },
    { id: 'SPOUSE', label: 'Vợ / Chồng' },
    { id: 'SIBLING', label: 'Anh / Chị / Em' },
    { id: 'PARENT', label: 'Bố / Mẹ' },
    { id: 'CHILD', label: 'Con / Cháu' },
    { id: 'FAVORITE', label: 'Yêu thích' },
    { id: 'NONE', label: 'Bỏ danh sách đặc biệt' },
  ]
};

export interface UserMenuContext {
  isFollowing?: boolean;
  isFriend?: boolean;
  isMuted?: boolean;
  isBlocked?: boolean;
}

export function getMenuItemsForContext(context: string, state: UserMenuContext = {}): MenuItemConfigDto[] {
  switch (context) {
    case 'all': {
      const allMenu: MenuItemConfigDto[] = [
        { id: 'view-profile', label: 'Xem trang cá nhân' },
        changeRelationshipMenu,
        state.isFollowing === false
          ? { id: 'follow', label: 'Theo dõi' }
          : { id: 'unfollow', label: 'Bỏ theo dõi' },
        state.isMuted === true
          ? { id: 'unmute', label: 'Bỏ ẩn (Unmute)' }
          : { id: 'mute', label: 'Ẩn (Mute) bảng tin / tin nhắn' },
        { id: 'unfriend', label: 'Hủy kết bạn' },
        state.isBlocked === true
          ? { id: 'unblock', label: 'Bỏ chặn' }
          : { id: 'block', label: 'Chặn người dùng' },
      ];
      return allMenu;
    }

    case 'close-friends':
    case 'relationships': {
      const relMenu: MenuItemConfigDto[] = [
        { id: 'view-profile', label: 'Xem trang cá nhân' },
        changeRelationshipMenu,
        state.isFollowing === false
          ? { id: 'follow', label: 'Theo dõi' }
          : { id: 'unfollow', label: 'Bỏ theo dõi' },
        state.isMuted === true
          ? { id: 'unmute', label: 'Bỏ ẩn (Unmute)' }
          : { id: 'mute', label: 'Ẩn (Mute)' },
        { id: 'remove-relationship', label: 'Xóa khỏi danh sách Mối quan hệ', isDanger: true },
        { id: 'unfriend', label: 'Hủy kết bạn' },
        state.isBlocked === true
          ? { id: 'unblock', label: 'Bỏ chặn' }
          : { id: 'block', label: 'Chặn người dùng' },
      ];
      return relMenu;
    }

    case 'following': {
      const followingMenu: MenuItemConfigDto[] = [
        { id: 'view-profile', label: 'Xem trang cá nhân' },
        { id: 'unfollow', label: 'Bỏ theo dõi' },
      ];
      if (state.isFriend === false) {
        followingMenu.push({ id: 'send-friend-request', label: 'Thêm bạn bè' });
      }
      followingMenu.push(
        state.isMuted === true
          ? { id: 'unmute', label: 'Bỏ ẩn (Unmute)' }
          : { id: 'mute', label: 'Ẩn (Mute)' },
        state.isBlocked === true
          ? { id: 'unblock', label: 'Bỏ chặn' }
          : { id: 'block', label: 'Chặn người dùng' },
      );
      return followingMenu;
    }

    case 'followers': {
      const followersMenu: MenuItemConfigDto[] = [
        { id: 'view-profile', label: 'Xem trang cá nhân' },
      ];
      if (state.isFriend === false) {
        followersMenu.push({ id: 'send-friend-request', label: 'Thêm bạn bè' });
      }
      followersMenu.push(
        { id: 'remove-follower', label: 'Xóa người theo dõi này', isDanger: true },
        state.isMuted === true
          ? { id: 'unmute', label: 'Bỏ ẩn (Unmute)' }
          : { id: 'mute', label: 'Ẩn (Mute)' },
        state.isBlocked === true
          ? { id: 'unblock', label: 'Bỏ chặn' }
          : { id: 'block', label: 'Chặn người dùng' },
      );
      return followersMenu;
    }

    case 'blocked':
      return [
        { id: 'view-profile', label: 'Xem trang cá nhân' },
        { id: 'unblock', label: 'Bỏ chặn' },
      ];

    case 'muted': {
      const mutedMenu: MenuItemConfigDto[] = [
        { id: 'view-profile', label: 'Xem trang cá nhân' },
        { id: 'unmute', label: 'Bỏ ẩn (Unmute)' },
      ];
      if (state.isFriend === true) {
        mutedMenu.push({ id: 'unfriend', label: 'Hủy kết bạn' });
      } else if (state.isFriend === false) {
        mutedMenu.push({ id: 'send-friend-request', label: 'Thêm bạn bè' });
      }
      mutedMenu.push(
        state.isBlocked === true
          ? { id: 'unblock', label: 'Bỏ chặn' }
          : { id: 'block', label: 'Chặn người dùng' },
      );
      return mutedMenu;
    }

    default:
      return [];
  }
}
