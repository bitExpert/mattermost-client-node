interface Team {
    id: string;
    create_at: number;
    update_at: number;
    delete_at: number;
    display_name: string;
    name: string;
    description: string;
    email: string;
    type: string;
    company_name: string;
    allowed_domains: string;
    invite_id: string;
    allow_open_invite: boolean;
    scheme_id: any; // check correct type
    group_constrained: any; // check correct type
}
