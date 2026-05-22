def for_user_geography(queryset, user):
    if not user or not user.is_authenticated:
        return queryset.none()
    if user.is_superuser or user.role in {"admin", "auditor", "supervisor"}:
        return queryset

    filters = {}
    model_field_names = {f.name for f in queryset.model._meta.fields}
    for field in ("region", "district", "block", "village"):
        value = getattr(user, field, "")
        if value and field in model_field_names:
            filters[field] = value
    return queryset.filter(**filters) if filters else queryset.none()
