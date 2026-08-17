def for_user_geography(queryset, user):
    if not user or not user.is_authenticated:
        return queryset.none()

    role = user.role

    # Superusers, global Admins, State Admins, and Auditors see everything
    if user.is_superuser or role in {"admin", "auditor", "state_admin"}:
        return queryset

    model = queryset.model
    model_field_names = {f.name for f in model._meta.fields}

    # ASHA worker scope
    if role == "health_worker" and "asha_worker" in model_field_names:
        return queryset.filter(asha_worker=user)

    filters = {}

    if role == "district_officer":
        if "district" in model_field_names and user.district:
            filters["district"] = user.district
    elif role == "block_manager":
        if "block" in model_field_names and user.block:
            filters["block"] = user.block
    elif role == "supervisor":
        # Supervisors (ANMs) can see everything in their queryset scope by default
        # (views apply further filtering as needed)
        return queryset
    else:
        # Standard fallback geo-scoping
        for field in ("region", "district", "block", "village"):
            value = getattr(user, field, "")
            if value and field in model_field_names:
                filters[field] = value

    return queryset.filter(**filters) if filters else queryset
