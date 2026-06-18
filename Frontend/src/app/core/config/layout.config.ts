export interface LayoutConfig {
  appConfiguration: {
    type?: 'navbar' | 'sidebar';
    theme?: 'light' | 'dark';
    sidebarPosition?: 'right' | 'left';
    showSidebarToggle?: boolean;
    showAgentChat?: boolean;
    showUserProfileView?: boolean;
    showNotifications?: boolean;
    logoLocationHeader?: boolean;
    collapsed?: boolean;
    isMobile: boolean;
    isFixed?: boolean;
  };
  theme: {
    name: string;
    primary: string;
    secondary: string;
    background: string;
    text: string;
    darkMode: boolean;
  };
  typography: {
    fontFamily: string;
    headingFont: string;
    bodyFont: string;
  };
}

export const defaultConfig: LayoutConfig = {
  appConfiguration: {
    type: 'navbar', // or 'sidebar'
    theme: 'light',
    sidebarPosition: 'right',
    logoLocationHeader: true, // true: header, false: sidebar
    showSidebarToggle: false,
    showAgentChat: false,
    showUserProfileView: false,
    showNotifications: false,
    collapsed: false,
    isMobile: true,
    isFixed: true,
  },
  theme: {
    name: 'theme-1',
    primary: '#2563eb',
    secondary: '#4f46e5',
    background: '#ffffff',
    text: '#1f2937',
    darkMode: false
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    headingFont: "'Poppins', sans-serif",
    bodyFont: "'Inter', sans-serif"
  }
};