def for_user_geography(queryset, user):
    if not user or not user.is_authenticated:
        return queryset.none()
    if user.is_superuser or user.role in {"admin", "auditor", "supervisor"}:
        return queryset

    model = queryset.model
    model_field_names = {f.name for f in model._meta.fields}

    if user.role == "health_worker" and "asha_worker" in model_field_names:
        return queryset.filter(asha_worker=user)

    filters = {}
    for field in ("region", "district", "block", "village"):
        value = getattr(user, field, "")
        if value and field in model_field_names:
            filters[field] = value
    return queryset.filter(**filters) if filters else queryset.none()
