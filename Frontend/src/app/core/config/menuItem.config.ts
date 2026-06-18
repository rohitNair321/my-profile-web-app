export class MenuItem {
    label: string;
    key: string;
    tooltip?: string;
    href?: string;       // For #section scrolling
    routerLink?: string; // For internal page navigation
    icon?: string;
    expanded?: boolean;
    role?: string; // To control visibility based on user role
    action?: boolean; // To make is understand if the menu has event( like click or press) or it just navigation
    subMenu?: MenuItem[];
    disabled?: boolean;
    isHide?: boolean;
    actions?: (value: any) => any;

    constructor(options: {
        label: string;
        key: string;
        tooltip?: string;
        href?: string;
        routerLink?: string;
        icon?: string;
        expanded?: boolean;
        role?: string;
        subMenu?: MenuItem[];
        disabled?:  boolean;
        isHide?: boolean;
        action?: boolean;
        actions?: (value: any) => any;
    }) {
        this.label = options.label;
        this.key = options.key;
        this.tooltip = options.tooltip;
        this.href = options.href;
        this.routerLink = options.routerLink;
        this.icon = options.icon;
        this.expanded = options.expanded;
        this.role = options.role;
        this.subMenu = options.subMenu;
        this.disabled = options.disabled;
        this.isHide = options?.isHide || false;
        this.action = options?.action || false;
        this.actions = options.actions;
    }
}